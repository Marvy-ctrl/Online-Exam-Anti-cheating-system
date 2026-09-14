export interface AdminExam {
  uid: string
  title: string
  subject_name: string | null
  duration_minutes: number
  description: string | null
  start_time: string
  end_time: string
  enroll_link: string | null
  exam_link: string | null
  link_start_time: string | null
  link_end_time: string | null
  shuffle_questions: boolean
  shuffle_options: boolean
}

export interface EnrolledStudent {
  uid: string
  first_name: string
  last_name: string
  email: string
  student_id: string
  status?: string
}

export interface ExamResult {
  session_uid: string
  student_uid: string
  student_name: string
  student_id: string
  email: string
  status: string
  score: number | null
  total_marks: number
  score_percentage: number | null
  adjustment_reason: string | null
  violation_count: number
  violation_summary: string
  end_time: string | null
}

export interface LiveExamEvent {
  id: number
  student_name: string
  student_id: string
  violation_type: string
  timestamp: string
  message: string
}

export type ExamWorkspaceTab =
  | 'overview'
  | 'enrolled'
  | 'questions'
  | 'results'
  | 'settings'

export type ToastMessage = {
  message: string
  type: 'success' | 'error'
}
