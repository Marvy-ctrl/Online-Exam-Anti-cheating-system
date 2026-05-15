# Phase 5: Exam Shell Decomposition & Security

The current `ExamPage` is 710 lines long and handles everything from DOM event listeners and WebSocket handshakes to webcam streaming and React state. This phase will decompose the component into manageable hooks and sub-components, and enforce strict Content Security Policy (CSP) headers.

## User Review Required

> [!NOTE]
> **CSP Implementation Approach**
> You mentioned that middleware is no longer used and replaced by `proxy.ts`. To avoid any conflicts with custom routing or proxy logic, I propose we set the CSP headers directly in `next.config.ts` using the built-in `headers()` configuration. This is the official Next.js method for statically injecting security headers to specific route patterns (e.g., `/exam/:path*`). Does this work for you?

## Proposed Changes

### 1. CSP Headers via `next.config.ts`
#### [MODIFY] [next.config.ts](file:///Users/saleem/Documents/Projects/Online-Exam-Anti-cheating-system/frontend/next.config.ts)
- Add an async `headers()` function to inject strict CSP headers specifically for the `/exam/:path*` routes.
- **Headers to add**:
  - `Content-Security-Policy`: `frame-ancestors 'none';` (Prevent clickjacking).
  - `X-Frame-Options`: `DENY` (Legacy clickjacking protection).

### 2. Custom Hooks Extraction
Create dedicated hooks in `frontend/src/hooks/exam/` to extract all the messy logic out of the main page component:
#### [NEW] `useExamTimer.ts`
- Extracts the countdown logic, `expected_end_time` handling, and the auto-submit trigger.
#### [NEW] `useBrowserViolations.ts`
- Extracts the `visibilitychange`, `blur`, and `contextmenu` event listeners.
- Handles the HTTP calls to `log_violation` and interacts with the WebSocket.
#### [NEW] `useWebcamMonitor.ts`
- Manages the `getUserMedia` stream, interval countdowns, and the `verify-face` HTTP loop.
#### [NEW] `useExamWebSocket.ts`
- Manages the WebSocket connection, reconnection logic, and heartbeat.

### 3. UI Component Decomposition
Create stateless (or strictly scoped) UI components in `frontend/src/components/exam/`:
#### [NEW] `ExamHeader.tsx`
- The top bar displaying student info, the timer, and the top submit button.
#### [NEW] `QuestionNavigator.tsx`
- The left sidebar with the grid of question buttons and answered/unanswered tally.
#### [NEW] `QuestionDisplay.tsx`
- The center panel rendering the current question and the selectable options.
#### [NEW] `LiveMonitorSidebar.tsx`
- The right sidebar holding the `video` element, progress bar, and the final submit button.
#### [NEW] `SubmitModal.tsx`
- The confirmation overlay.

### 4. Refactoring the Main Page
#### [MODIFY] [page.tsx](file:///Users/saleem/Documents/Projects/Online-Exam-Anti-cheating-system/frontend/src/app/exam/[exam_uid]/[enrollment_uid]/page.tsx)
- Rip out all the raw `useEffect` and `useState` blocks.
- Replace them with calls to our new hooks.
- Replace the raw HTML/Tailwind with our new UI components.
- The file will shrink from 710 lines to ~100 lines, acting simply as the orchestrator.

## Verification Plan
1. **Load Exam**: Ensure the exam page loads and state is correctly initialized.
2. **Interact**: Verify that selecting answers, navigating questions, and the timer all function seamlessly.
3. **Monitor**: Confirm the webcam successfully grabs the stream, runs the 20-second interval, and detects tab switches.
4. **Security**: Inspect the network tab on an `/exam/` route to verify the `Content-Security-Policy` and `X-Frame-Options` headers are present.
