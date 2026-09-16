# ExamLoc frontend

The frontend is a Next.js 16 App Router application using React 19, TypeScript, Tailwind CSS, and Vitest. It provides administrator workspaces, student enrollment, secure exam entry, the examination interface, live monitoring, analytics, and post-exam audit views.

## Configuration

Create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

`NEXT_PUBLIC_BACKEND_URL` is the backend origin without `/api/v1`. Because public environment values are embedded at build time, change the value before building or redeploy after changing it.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
npm run test:watch
./node_modules/.bin/tsc --noEmit
```

`npm run dev` starts the development server at `http://localhost:3000`. The API and supporting backend services must be started separately.

## Structure

```text
src/
├── app/                       App Router pages and route-level coordinators
├── components/
│   ├── auth/                  Authentication forms
│   ├── dashboard/             Administrator workspaces and focused panels
│   ├── enrollment/            Multi-capture face enrollment flow
│   └── exam/                  Student exam presentation components
├── hooks/
│   ├── exam/                  Timer, answer sync, proctoring, monitoring
│   └── ...                    Workspace and audit data orchestration
├── lib/                       API clients and pure helpers
└── types/                     Shared TypeScript data contracts
```



## Student exam reliability

- The backend-provided `expected_end_time` drives the countdown; the browser is not authoritative for the deadline.
- The expected end time is cached in session storage only to restore the display after refresh.
- Answers are saved to the backend immediately and retried up to three times for transient failures.
- Saved answers are restored from PostgreSQL when the exam workspace reloads.
- Fullscreen, focus, visibility, and webcam events are monitoring signals sent to the backend.
- Live face captures are sent to the server-side biometric pipeline; the browser does not make the authoritative identity decision.

## Authentication behavior

Administrator API requests use the shared `apiFetch` client, which sends credentials and performs the supported access-token refresh flow. Student exam requests use the scoped session identity supplied by the backend. Frontend checks improve navigation and feedback, but backend authorization remains the security boundary.

## Testing

Vitest runs in JSDOM with Testing Library. Tests currently cover pure exam helpers, administrator exam-workspace state, tab coordination, audit-event expansion, question-list interactions, and refresh behavior after mutations.

Before committing a frontend change, run:

```bash
npm test
npm run lint
./node_modules/.bin/tsc --noEmit
```

The repository may contain unrelated historical lint warnings. New or edited files should introduce no ESLint errors or warnings.

## Next.js version note

This project uses Next.js `16.2.3`. When changing framework behavior, consult the documentation bundled under `node_modules/next/dist/docs/`; assumptions based on older App Router releases may no longer apply.
