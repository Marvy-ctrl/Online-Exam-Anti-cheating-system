import type { ExamIdentity } from '@/src/types/exam'

const backendOrigin = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export const EXAM_API_BASE_URL = `${backendOrigin.replace(/\/$/, '')}/api/v1`

export function examSessionUrl(
  { examUid, enrollmentUid }: ExamIdentity,
  suffix: string,
) {
  return `${EXAM_API_BASE_URL}/exam_session/${examUid}/student/${enrollmentUid}${suffix}`
}

export function examWebSocketUrl({ examUid, enrollmentUid }: ExamIdentity) {
  const url = new URL(backendOrigin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/api/v1/exam_session/${examUid}/student/${enrollmentUid}/ws`
  url.search = ''
  url.hash = ''
  return url.toString()
}
