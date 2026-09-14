import type { AdminExam } from '@/src/types/admin-exam'

export function getExamStatus(exam: AdminExam) {
  const now = new Date()
  const start = new Date(exam.start_time)
  const end = new Date(exam.end_time)
  if (now < start) {
    return {
      label: 'Upcoming',
      className: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    }
  }
  if (now > end) {
    return {
      label: 'Closed',
      className: 'bg-slate-100 text-slate-600 border-slate-200',
    }
  }
  return {
    label: 'Active',
    className: 'bg-green-50 text-green-700 border-green-100',
  }
}

export function examinerWebSocketUrl(examUid: string) {
  const backendOrigin =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
  const url = new URL(backendOrigin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/api/v1/exam_session/${examUid}/monitor/ws`
  url.search = ''
  url.hash = ''
  return url.toString()
}
