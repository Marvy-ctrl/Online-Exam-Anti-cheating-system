# ExamLoc — VPS Staging Deployment

Frontend stays on Vercel (`https://examloc.xyz`). This deploys the backend, workers,
Postgres, Redis and MinIO to your VPS at `https://api.examloc.xyz`.

**Staging only.** Read [§9](#9-before-real-students-touch-this) before enrolling
anyone's real face.

---

## Why `api.examloc.xyz` and not an IP

`examloc.xyz` and `api.examloc.xyz` share a registrable domain, so browsers treat
them as **same-site**. Your existing `SameSite=Lax` admin cookies are therefore sent
on cross-origin XHR from Vercel without modification. A bare IP or a different domain
would be cross-site and would require rewriting the cookie handling to
`SameSite=None`. Use the subdomain.

---

## 1. Pre-flight: what is already on this VPS

You have another project running. Run these **before** anything else and read the
output — do not skip this.

```bash
# Which host ports are taken? Look for 80, 443, 5432, 6379, 8100, 9000.
sudo ss -tulpn | grep LISTEN

# Which reverse proxy is in play? Tells you which config file to use in §5.
which nginx caddy 2>/dev/null; docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'

# Name collisions — this compose file uses examloc-* container names.
docker ps -a --format '{{.Names}}' | grep -i examloc

# Disk and RAM. dlib needs ~2GB free RAM to compile.
free -h; df -h /
```

If `8100` is taken, set `API_HOST_PORT` in `.env` to something free and update the
`proxy_pass` / `reverse_proxy` port in your proxy config to match.

`docker-compose.prod.yml` publishes **no** database, Redis or MinIO ports, so those
cannot collide with your other project. Only the loopback API port can.

---

## 2. Get the code onto the VPS

> Deploying from a second computer, or want a dedicated `examloc` account rather than
> your admin user? Do [`deploy/VPS-ACCESS.md`](deploy/VPS-ACCESS.md) first — it covers
> the workstation SSH key, the `examloc` user, and the GitHub deploy key the VPS needs
> to clone a private repo. It ends with the clone below already done.

```bash
sudo mkdir -p /opt/examloc && sudo chown "$USER":"$USER" /opt/examloc
git clone <your-repo-url> /opt/examloc && cd /opt/examloc
```

Clone rather than `scp` — the working tree is ~1.6 GB because of `env/` and
`node_modules/`, neither of which is tracked. If you must copy manually:

```bash
rsync -av --exclude='env/' --exclude='node_modules/' --exclude='.next/' \
      --exclude='.git/' ./ user@vps:/opt/examloc/
```

---

## 3. Generate secrets and write `.env`

```bash
cd /opt/examloc
cp .env.production.example .env

# Generate seven distinct secrets:
for k in POSTGRES_PASSWORD REDIS_PASSWORD JWT_SECRET_EXAMINER JWT_SECRET_STUDENT \
         MINIO_SECRET_KEY ENCRYPTION_KEY; do
  printf '%s=%s\n' "$k" "$(openssl rand -hex 32)"
done
```

Paste those in, then propagate the two passwords into the URLs by hand:

- `DATABASE_URL` — the password must match `POSTGRES_PASSWORD`, host stays `postgres`
- `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` — all three carry
  `REDIS_PASSWORD` as `redis://:<password>@redis:6379/0`

Then set:

| Key | Value |
|---|---|
| `DOMAIN` | `https://api.examloc.xyz` |
| `FRONTEND_URL` | `https://examloc.xyz` (no trailing slash) |
| `COOKIE_SECURE` | `true` |
| `SMTP_*` | real credentials — Gmail needs an App Password |

Lock it down and verify nothing is left unfilled:

```bash
chmod 600 .env
grep -n 'CHANGE_ME' .env && echo ">>> STILL PLACEHOLDERS ABOVE <<<" || echo "OK: no placeholders"
```

> **Do not create `backend/src/.env`.** `config.py` sets `extra="forbid"`, and the
> `POSTGRES_*` keys in `.env` are not declared in `Settings` — pydantic would refuse
> to start. The root `.env` is sufficient; compose injects it via `env_file`, and
> undeclared *process* env vars are ignored safely.

---

## 4. DNS

Add an A record for `api` → your VPS IPv4, then confirm it resolves before
requesting a certificate:

```bash
dig +short api.examloc.xyz    # must return your VPS IP
```

Certbot will fail the HTTP-01 challenge if this hasn't propagated. If `examloc.xyz`
is on Cloudflare, set the `api` record to **DNS only** (grey cloud) for the initial
issuance.

---

## 5. Build and start

```bash
cd /opt/examloc
docker compose -f docker-compose.prod.yml up -d --build
```

The first build compiles **dlib from source** — expect 10–25 minutes and near-total
CPU use. On 4 GB this succeeds; if it dies with `Killed` or `c++: fatal error`, it
ran out of memory. Add swap and retry:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
```

Watch it come up:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

Tables are created automatically by `init_db()` on startup, but existing columns are
changed only by Alembic. The single authoritative migration configuration lives in
`backend/alembic.ini` and is included in the API image.

Before the first v2 deployment, take a database backup. Databases previously managed
only by `create_all()` have no Alembic revision marker, so baseline them at the last
legacy schema revision and then run the encryption migration:

```bash
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml run --rm api alembic stamp b94c987f123b
docker compose -f docker-compose.prod.yml run --rm api alembic upgrade head
docker compose -f docker-compose.prod.yml up -d
```

Do not run `stamp` on a database that already reports an Alembic revision; use
`alembic current` first. Migration `c7f2a9d4e6b1` encrypts existing `FLOAT[]`
embeddings into authenticated `TEXT` ciphertext without requiring re-enrollment. It
is also safe when a fresh database already has the current `TEXT` column.

Verify locally on the box before exposing it:

```bash
# Docs live under the version prefix, not at /docs (src/__init__.py:45).
curl -sI http://127.0.0.1:8100/api/v1/docs | head -1     # expect: HTTP/1.1 200 OK
```

A `404` here is not a crash — it means uvicorn is up and routing, you just asked for a
path that doesn't exist. Confirm the app is genuinely healthy with:

```bash
docker compose -f docker-compose.prod.yml ps          # api should read (healthy)
curl -s http://127.0.0.1:8100/api/v1/openapi.json | head -c 120
```

---

## 6. Reverse proxy + TLS

**nginx:**
```bash
sudo cp deploy/nginx-api.examloc.xyz.conf /etc/nginx/sites-available/api.examloc.xyz
sudo ln -s /etc/nginx/sites-available/api.examloc.xyz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.examloc.xyz
```

If `nginx -t` reports a duplicate `$connection_upgrade` map, you already define it
globally — delete the `map` block at the top of the file and re-test.

**Caddy:** append `deploy/Caddyfile.api.examloc.xyz` to `/etc/caddy/Caddyfile`, then
`sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`.
TLS is automatic.

Both configs set a 25 MB body limit — face enrollment posts five base64 JPEGs in one
request and would hit nginx's 1 MB default as an opaque network error — and a
3600s read timeout so idle proctoring WebSockets aren't dropped between heartbeats.

---

## 7. Point Vercel at the API

In the Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_BACKEND_URL = https://api.examloc.xyz
```

**Then redeploy.** `NEXT_PUBLIC_*` is inlined at build time, so an existing
deployment will keep calling `http://localhost:8000` until it's rebuilt. No frontend
code changes are needed — the WebSocket URLs already derive `wss:` from
`window.location.protocol`.

---

## 8. Smoke test

```bash
# TLS + reachability
curl -sI https://api.examloc.xyz/api/v1/docs | head -1

# CORS preflight must echo your Vercel origin
curl -si -X OPTIONS https://api.examloc.xyz/api/v1/auth/login \
  -H 'Origin: https://examloc.xyz' \
  -H 'Access-Control-Request-Method: POST' | grep -i 'access-control-allow'

# WebSocket upgrade must return 101, not 200/404/502
curl -si -N https://api.examloc.xyz/api/v1/exam_session/test/monitor/ws \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' | head -1

# Confirm nothing sensitive is publicly bound — all four should FAIL to connect
for p in 5432 5433 6379 9000 9001; do
  timeout 3 bash -c "</dev/tcp/api.examloc.xyz/$p" 2>/dev/null \
    && echo "!! PORT $p IS PUBLICLY OPEN" || echo "ok: $p closed"
done
```

> **Expect 5432 and 6379 to report OPEN on this VPS — that is the *other* project, not
> this one.** Its compose publishes `0.0.0.0:5432` (sps-postgres) and `0.0.0.0:6379`
> (sps-redis). Nothing in `docker-compose.prod.yml` publishes either port, so this
> stack is not the cause and changing it will not fix them. See the note below.
> `9000`, `9001` and `5433` must all be closed — if any of those is open, that *is* ours.

### The other project's exposed ports

`sps-postgres` and `sps-redis` are reachable from the internet. Redis is the more
serious of the two: if it has no `requirepass`, an unauthenticated attacker can read
every key and often achieve RCE by rewriting the RDB path. Verify from a machine that
is **not** the VPS:

```bash
redis-cli -h 2.24.95.77 ping        # PONG = wide open. NOAUTH = password set.
nc -vz 2.24.95.77 5432             # succeeded = Postgres reachable
```

Note that `ufw` almost certainly does **not** protect these. Docker writes its own
DNAT rules into the `nat` table, which are evaluated before ufw's filtering, so a
published container port bypasses `ufw deny` entirely. The fix is to stop publishing
them — in that project's compose, bind to loopback:

```yaml
ports:
  - "127.0.0.1:5432:5432"     # was "5432:5432"
  - "127.0.0.1:6379:6379"
```

Containers on the same Docker network reach each other by service name without any
`ports:` entry at all, so this usually breaks nothing. Out of scope for this
deployment, but worth doing the same day.

Then in the browser: sign up, verify email, create an institution → subject → exam,
add questions, pre-enroll a test student, send the enrollment link, register a face,
and sit the exam. Watch `docker compose -f docker-compose.prod.yml logs -f worker-face`
during the sitting — you should see `verify_face_task: completed` roughly every 20s.

Cookies to confirm in DevTools → Application → Cookies: `access_token` should show
`Secure ✓  HttpOnly ✓  SameSite=Lax`.

---

## 9. Before real students touch this

The v2 hardening pass now protects score changes, results, session details, webcam
evidence, and the examiner monitoring WebSocket with authentication, role checks,
and exam ownership checks. Local snapshot fallback files are served only through
the protected evidence endpoint; there is no public `/static` mount.

Operational requirements and remaining capacity work:

- No rate limiting on `/auth/login` — unthrottled bcrypt.
- Celery Beat now checks once per minute for overdue `in_progress` sessions, records
  their authoritative deadline as the completion time, and queues grading. It also
  recovers submitted sessions whose original grading dispatch was interrupted.
- Submission queues grading with `.delay()`, so the API can return without running
  the grader in the request process. Keep both `worker-grading` and `beat` running.
- Successful face-verification frames are never retained. The first frame for each
  violation type is retained as review evidence, while repeat events increment its
  occurrence count. Beat purges evidence rows and files after
  `SNAPSHOT_RETENTION_DAYS` (seven days by default); MinIO lifecycle expiry provides
  a second deletion layer.
- Face worker is `--pool=solo --concurrency=1`: ~23 concurrent students before the
  queue grows unbounded.
- Keep the API at **one** uvicorn worker. `ConnectionManager` stores sockets in
  process memory, so a second worker would silently drop monitor alerts.

---

## 10. Operations

```bash
cd /opt/examloc
C="docker compose -f docker-compose.prod.yml"

$C ps                          # status
$C logs -f api                 # tail
$C restart api                 # restart one service
git pull && $C up -d --build   # deploy an update
$C down                        # stop (volumes persist)

# Backup — do this before any schema change
$C exec -T postgres pg_dump -U examloc examloc_db | gzip > "backup-$(date +%F).sql.gz"

# MinIO console (not publicly exposed — tunnel from your laptop)
ssh -L 9001:localhost:9001 user@vps   # then open http://localhost:9001
```

Log rotation is capped at 10 MB × 3 files per service, so this cannot fill the disk
shared with your other project.

### If something breaks

| Symptom | Cause |
|---|---|
| API exits immediately, `SettingsError` about a dotenv key | You created `backend/src/.env`. Delete it; use the root `.env`. |
| API can't reach the DB | `DATABASE_URL` host must be `postgres`, not `db` or `localhost`. |
| Browser: CORS error | `FRONTEND_URL` must exactly equal `https://examloc.xyz`, no trailing slash. Restart the API after editing. |
| Login succeeds, next request 401s | Cookie rejected. Confirm `COOKIE_SECURE=true` and that you're on HTTPS. |
| Frontend still calling localhost:8000 | Vercel wasn't redeployed after setting `NEXT_PUBLIC_BACKEND_URL`. |
| Monitor dashboard never connects | WebSocket not upgrading — check the proxy `location` block precedes `location /`. |
| Face enrollment fails, generic network error | Body limit. Confirm `client_max_body_size 25M`. |
| dlib build `Killed` | Out of RAM. Add swap (§5). |
| Snapshots broken in the audit view | `DOMAIN` is wrong — it's baked into the image URLs. |
