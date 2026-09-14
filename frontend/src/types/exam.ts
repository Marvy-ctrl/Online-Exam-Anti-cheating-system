export interface ExamOption {
  uid: string
  option_text: string
  order_index: number
}

export interface ExamQuestion {
  uid: string
  question_text: string
  order_index: number
  options: ExamOption[]
}

export interface ExamData {
  exam_uid: string
  session_uid: string
  questions: ExamQuestion[]
  student_first_name: string
  student_last_name: string
  student_id: string
  saved_answers: Record<string, string[]>
  expected_end_time?: string
}

export type AnswerState = Record<string, string>
export type SaveStatus = 'idle' | 'saving' | 'error'
export type FaceStatus = 'ok' | 'warning' | 'checking'

export interface ExamIdentity {
  examUid: string
  enrollmentUid: string
}
