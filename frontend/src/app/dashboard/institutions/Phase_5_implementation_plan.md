# Phase 5 completion record: exam shell decomposition

Status: implemented and verified.

The former monolithic student exam page was decomposed into route coordination, focused hooks, shared types, and presentation components.

## Extracted hooks

- `useExamTimer.ts` - renders time from the backend-authoritative `expected_end_time` and triggers expiry handling.
- `useAnswerSync.ts` - saves answers with bounded retry and reports per-question save status.
- `useBrowserViolations.ts` - handles focus, visibility, fullscreen, and prohibited browser interactions.
- `useWebcamMonitor.ts` - acquires the webcam and dispatches periodic captures to the server-side verification pipeline.
- `useExamWebSocket.ts` - manages the live session connection and reconnect behavior.

## Extracted components

- `ExamHeader.tsx`
- `QuestionNavigator.tsx`
- `QuestionDisplay.tsx`
- `ProctoringPanels.tsx`
- `ExamOverlays.tsx`

## Result

The page now coordinates the extracted concerns instead of implementing them inline. The backend remains authoritative for identity, authorization, timing, answers, and submission state.

Browser security headers were not part of this decomposition and remain a separate production-hardening task. Their design must be validated against the current Next.js version and the application’s camera, API, WebSocket, image, and deployment origins before enforcement.
