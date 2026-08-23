# VPS access setup — new workstation → `examloc` user → GitHub

One-time setup so you can deploy from a second computer. Three separate credentials
are involved; conflating them is the usual source of confusion:

| # | Credential | Lives on | Proves | Created in |
|---|---|---|---|---|
| 1 | Your workstation SSH key | new computer | *you* → VPS | §2 |
| 2 | GitHub deploy key | the VPS | *VPS* → GitHub | §5 |
| 3 | Existing admin access | your Mac | bootstraps §3–4 | already have |

Order matters: the `examloc` account does not exist yet, so it cannot authorise its
own key. You create it from the admin access you already have.

---

## 1. Read this before creating the user

You chose a dedicated user **without sudo**, which is the right call — but be clear
on what it buys, because one detail is widely misrepresented:

> **Membership in the `docker` group is equivalent to root.** Anyone in it can run
> `docker run -v /:/host ... chroot /host` and own the machine. Since `examloc` must
> be in `docker` to run the stack, withholding sudo is **not** a privilege boundary.

What it genuinely gives you: clean file ownership under `/opt/examloc`, a separate
shell history and crontab from your other project, no accidental `sudo rm` against the
wrong tree, and single-command revocation (`sudo usermod -L examloc`). Those are real
operational wins. Treat them as hygiene, not as a security sandbox — an attacker who
gets a shell as `examloc` is one command from root either way.

If you later want a true boundary, the answer is rootless Docker or a separate VPS,
not sudo removal.

---

## 2. On the NEW computer — generate your key

```bash
ssh-keygen -t ed25519 -a 100 -C "examloc-deploy-$(hostname -s)" -f ~/.ssh/examloc_vps
```

Accept the passphrase prompt with a real passphrase — it is the only thing protecting
the key if the laptop is stolen. `ssh-agent` means you type it once per session:

```bash
ssh-add ~/.ssh/examloc_vps          # macOS: add --apple-use-keychain to persist
```

A dedicated key rather than reusing an existing one keeps this project revocable on
its own. Now print the **public** half — this is the only part that leaves the machine:

```bash
cat ~/.ssh/examloc_vps.pub
```

> Never send `~/.ssh/examloc_vps` (no `.pub`) anywhere. If you ever paste a key that
> begins `-----BEGIN OPENSSH PRIVATE KEY-----`, treat it as compromised and start over.

---

## 3. From your Mac (existing access) — create the user

```bash
ssh <your-admin-user>@<VPS_IP>
```

```bash
# Key-only account: --disabled-password sets no password, so password SSH and
# `su examloc` are both impossible. Home dir and group are created for you.
sudo adduser --disabled-password --gecos "" examloc

# Required to run the stack. See §1 for what this implies.
sudo usermod -aG docker examloc

# App directory, owned by the new user so the deploy needs no sudo.
sudo mkdir -p /opt/examloc
sudo chown examloc:examloc /opt/examloc
```

Verify before moving on:

```bash
id examloc                      # expect: groups=...(examloc),...(docker)
getent group docker             # examloc must appear
ls -ld /opt/examloc             # expect: drwxr-xr-x ... examloc examloc
```

If `getent group docker` returns nothing, Docker isn't installed yet — install it
first, since the group is created by its package.

---

## 4. Still on the VPS — install your workstation key

`ssh-copy-id` cannot be used here: it authenticates with a password, and §3 created
the account without one. Install it manually instead.

Paste the `examloc_vps.pub` line from §2 in place of `ssh-ed25519 AAAA...`:

```bash
sudo -u examloc mkdir -p -m 700 /home/examloc/.ssh

printf '%s\n' 'ssh-ed25519 AAAA...REPLACE_WITH_YOUR_PUBLIC_KEY... examloc-deploy-host' \
  | sudo -u examloc tee -a /home/examloc/.ssh/authorized_keys >/dev/null

sudo -u examloc chmod 600 /home/examloc/.ssh/authorized_keys
```

Running these as `sudo -u examloc` means ownership is correct by construction —
wrong ownership or loose permissions on `.ssh` make sshd silently ignore the key,
which is the single most common cause of "it still asks for a password".

Confirm:

```bash
sudo -u examloc ls -la /home/examloc/.ssh
# .ssh must be 700, authorized_keys 600, both owned examloc:examloc
```

### Test from the new computer — do NOT close your admin session yet

```bash
ssh -i ~/.ssh/examloc_vps examloc@<VPS_IP> 'whoami; docker ps --format "{{.Names}}"'
```

Expect `examloc`, then your other project's containers. If `docker ps` says *permission
denied on the Docker daemon socket*, the group hasn't taken effect — log out and back
in, since group membership is applied at login.

If auth fails, diagnose from the still-open admin session:

```bash
sudo tail -20 /var/log/auth.log      # RHEL/Alma: /var/log/secure
```

---

## 5. On the VPS as `examloc` — GitHub deploy key

The repo is private, so the VPS needs its own read-only credential. A **deploy key**
is scoped to this one repository; a personal access token would grant access to your
whole account and needs rotating.

```bash
ssh examloc@<VPS_IP>

ssh-keygen -t ed25519 -C "examloc-vps-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

`-N ""` (no passphrase) is deliberate here — `git pull` must work unattended. The key
is read-only and repo-scoped, so the tradeoff is acceptable.

Add it on GitHub: **repo → Settings → Deploy keys → Add deploy key**. Title it
`examloc-vps`, paste the public key, and **leave "Allow write access" unchecked** — the
VPS only ever pulls.

Tell SSH to use it for GitHub:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

`IdentitiesOnly yes` stops SSH from offering every key it knows; without it GitHub may
reject you for too many failed attempts before reaching the right one.

Verify, then clone:

```bash
ssh -T git@github.com
# Expect: "Hi Marvy-ctrl/Online-Exam-Anti-cheating-system! You've successfully
# authenticated, but GitHub does not provide shell access." — that IS success.

git clone git@github.com:Marvy-ctrl/Online-Exam-Anti-cheating-system.git /opt/examloc
cd /opt/examloc && git log --oneline -3
```

If it says *repository not found*, the deploy key wasn't added to this repo — GitHub
returns that instead of a permission error for private repos.

### Do NOT copy your laptop's GitHub key to the VPS

It is tempting to `scp ~/.ssh/id_ed25519` across and be done. Don't:

- That key is your **account** identity, not a per-repo credential — it can reach every
  repository you can, usually with **write** access.
- `examloc` is in the `docker` group, which is root-equivalent (§1). Anyone who gets a
  shell on this VPS reads that key and inherits your GitHub account.
- Revoking it breaks your laptop too, because it's the same key.

A deploy key is read-only and scoped to one repo. Losing it costs you nothing.

### Alternative: agent forwarding (no key on the VPS at all)

Useful if you want to avoid touching GitHub settings, or for a one-off clone. Your
laptop's key is used over the SSH channel and never written to VPS disk.

On the **workstation**:

```bash
ssh-add -l                       # confirm your GitHub key is loaded
ssh-add ~/.ssh/id_ed25519        # if not — use your actual GitHub key path
ssh -A -i ~/.ssh/examloc_vps examloc@<VPS_IP>
```

Then on the VPS, `ssh -T git@github.com` and `git clone` work through the forwarded
agent — skip the `~/.ssh/config` block above, since there is no local key to point at.

Two limitations decide against this as the permanent setup:

1. **Every `git pull` needs forwarding active.** Unattended updates and cron cannot use
   it. DEPLOY.md §10's `git pull && docker compose up -d --build` would fail from a
   plain session.
2. **While connected, root on the VPS can use your agent** to authenticate as you,
   write access included. Fine for a few minutes on a box you control; not something to
   leave enabled via `ForwardAgent yes` in your config.

Use forwarding to get unblocked now if you like, then add the deploy key before you
rely on `git pull`.

---

## 6. On the NEW computer — a host alias

```bash
cat >> ~/.ssh/config <<'EOF'

Host examloc-vps
    HostName <VPS_IP>
    User examloc
    IdentityFile ~/.ssh/examloc_vps
    IdentitiesOnly yes
    ServerAliveInterval 60
EOF
chmod 600 ~/.ssh/config
```

Now `ssh examloc-vps` is enough. `ServerAliveInterval 60` keeps the session alive
through the long dlib build in DEPLOY.md §5.

For that build specifically, run it under `tmux` so a dropped connection doesn't kill
a 25-minute compile:

```bash
ssh examloc-vps
tmux new -s deploy        # detach with Ctrl-b then d; resume with: tmux attach -t deploy
```

---

## 7. Harden sshd — carefully

Your other project is on this box. A bad sshd config can lock you out of both.

**Keep an existing SSH session open throughout this section.** If you break the config,
that session is your only way back in.

Check the *effective* config first — cloud images often ship overrides in
`/etc/ssh/sshd_config.d/` that silently win over the main file:

```bash
sudo sshd -T | grep -Ei 'passwordauthentication|permitrootlogin|pubkeyauthentication'
ls -la /etc/ssh/sshd_config.d/ 2>/dev/null
```

If password auth is still on, and **only after §4 key login is confirmed working**:

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF

sudo sshd -t && echo "config valid"     # MUST pass before the next line
sudo sshd -T | grep -i passwordauthentication   # expect: no
sudo systemctl reload ssh               # some distros: systemctl reload sshd
```

A numbered drop-in beats editing `sshd_config` directly: it survives package upgrades
and is trivially reversible (`sudo rm` the file, reload).

**Why the drop-in wins.** For most keywords OpenSSH uses the **first** value it obtains,
not the last. Ubuntu's `sshd_config` has `Include /etc/ssh/sshd_config.d/*.conf` at
line 12, well before its own `PasswordAuthentication` at line 57 — so your drop-in is
read first and the main file's setting is ignored. Confirm the ordering on your box:

```bash
grep -n '^Include' /etc/ssh/sshd_config      # should be a low line number
grep -n 'PasswordAuthentication' /etc/ssh/sshd_config
```

If `Include` is absent or appears *after* those keywords (some non-Debian images),
the drop-in will be silently overridden — edit `sshd_config` directly instead. Either
way `sudo sshd -T` is the authoritative answer; trust it over the files.

Then, from a **new** terminal, confirm you can still get in as both `examloc` and your
admin user before closing the original session.

> Make sure your admin user has a working SSH key too. Disabling password auth while
> that account is password-only locks you out of the sudo you need for nginx and
> certbot in DEPLOY.md §6.

---

## 8. Where this leaves you

```bash
ssh examloc-vps
cd /opt/examloc
```

You're now at DEPLOY.md §1 (pre-flight), with §2 (clone) already done. Steps needing
sudo — nginx, certbot, swap — run from your admin account, not `examloc`.

### Revoking access later

```bash
# One workstation
sudo -u examloc sed -i '/examloc-deploy-hostname/d' /home/examloc/.ssh/authorized_keys

# The whole account
sudo usermod -L examloc && sudo usermod -s /usr/sbin/nologin examloc

# GitHub: repo → Settings → Deploy keys → delete examloc-vps
```
