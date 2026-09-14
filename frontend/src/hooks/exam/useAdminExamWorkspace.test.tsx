import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminExamWorkspace } from './useAdminExamWorkspace'
import { apiFetch } from '@/src/lib/api'

const push = vi.fn()
const router = { push }

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

vi.mock('@/src/lib/api', () => ({
  apiFetch: vi.fn(),
}))

const mockedApiFetch = vi.mocked(apiFetch)
const exam = {
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
const students = [{
  uid: 'student-1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.test',
  student_id: 'ST-1',
  status: 'enrolled',
}]

function response(ok: boolean, body: unknown = {}) {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAdminExamWorkspace', () => {
  it('loads exam details and enrolled students together', async () => {
    mockedApiFetch
      .mockResolvedValueOnce(response(true, exam))
      .mockResolvedValueOnce(response(true, students))

    const { result } = renderHook(() =>
      useAdminExamWorkspace({ examUid: 'exam-123', institutionUid: 'institution-1' }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.exam).toEqual(exam)
    expect(result.current.students).toEqual(students)
    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, '/exam/exam-123')
    expect(mockedApiFetch).toHaveBeenNthCalledWith(2, '/exam/exam-123/students')
  })

  it('returns to the institution when the exam cannot be loaded', async () => {
    mockedApiFetch
      .mockResolvedValueOnce(response(false))
      .mockResolvedValueOnce(response(true, []))

    const { result } = renderHook(() =>
      useAdminExamWorkspace({ examUid: 'missing', institutionUid: 'institution-1' }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(push).toHaveBeenCalledWith('/dashboard/institutions/institution-1')
  })

  it('deletes only after confirmation and then returns to the institution', async () => {
    mockedApiFetch
      .mockResolvedValueOnce(response(true, exam))
      .mockResolvedValueOnce(response(true, students))
      .mockResolvedValueOnce(response(true))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

    const { result } = renderHook(() =>
      useAdminExamWorkspace({ examUid: 'exam-123', institutionUid: 'institution-1' }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.deleteExam())

    expect(mockedApiFetch).toHaveBeenLastCalledWith('/exam/delete_exam/exam-123', { method: 'DELETE' })
    expect(push).toHaveBeenCalledWith('/dashboard/institutions/institution-1')
    expect(alert).not.toHaveBeenCalled()
  })
})
