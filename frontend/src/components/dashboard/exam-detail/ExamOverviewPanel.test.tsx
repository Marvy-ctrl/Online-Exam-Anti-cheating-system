import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExamOverviewPanel } from './ExamOverviewPanel'
import { apiFetch } from '@/src/lib/api'
import type { AdminExam } from '@/src/types/admin-exam'

vi.mock('@/src/lib/api', () => ({ apiFetch: vi.fn() }))
vi.mock('@/components/ui/datetime-picker', () => ({
  DateTimePicker: () => <div data-testid="date-time-picker" />,
}))

const mockedApiFetch = vi.mocked(apiFetch)
const exam: AdminExam = {
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

beforeEach(() => vi.clearAllMocks())

describe('ExamOverviewPanel', () => {
  it('generates an exam link and refreshes the shared workspace data', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true } as Response)
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ExamOverviewPanel exam={exam} students={[]} onRefresh={onRefresh} />)

    await user.click(screen.getByRole('button', { name: 'Generate Exam Link' }))

    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce())
    expect(mockedApiFetch).toHaveBeenCalledWith('/exam/exam-123/exam-link', { method: 'POST' })
  })

  it('disables invitation and exam-link email actions when there are no eligible students', () => {
    render(<ExamOverviewPanel exam={{ ...exam, enroll_link: 'https://examloc.test/enroll' }} students={[]} onRefresh={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Send to 0 Pending Students' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Send Exam Link to Students' })).not.toBeInTheDocument()
  })
})
