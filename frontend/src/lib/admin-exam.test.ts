import { afterEach, describe, expect, it, vi } from 'vitest'
import { examinerWebSocketUrl, getExamStatus } from './admin-exam'
import type { AdminExam } from '@/src/types/admin-exam'

const baseExam: AdminExam = {
  uid: 'exam-123',
  title: 'Biology',
  subject_name: 'Biology',
  duration_minutes: 60,
  description: null,
  start_time: '2026-09-04T11:00:00.000Z',
  end_time: '2026-09-04T13:00:00.000Z',
  enroll_link: null,
  exam_link: null,
  link_start_time: null,
  link_end_time: null,
  shuffle_questions: false,
  shuffle_options: false,
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('getExamStatus', () => {
  it.each([
    ['Upcoming', '2026-09-04T10:59:59.000Z'],
    ['Active', '2026-09-04T12:00:00.000Z'],
    ['Closed', '2026-09-04T13:00:01.000Z'],
  ])('returns %s for the applicable time window', (expected, now) => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    expect(getExamStatus(baseExam).label).toBe(expected)
  })
})

describe('examinerWebSocketUrl', () => {
  it('converts an HTTPS backend URL to a secure monitor WebSocket URL', () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.examloc.test/api/v1?old=true')
    expect(examinerWebSocketUrl('exam-123')).toBe(
      'wss://api.examloc.test/api/v1/exam_session/exam-123/monitor/ws',
    )
  })
})
