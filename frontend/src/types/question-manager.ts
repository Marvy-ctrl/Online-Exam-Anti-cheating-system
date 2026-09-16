export interface QuestionOption {
  uid: string
  option_text: string
  is_correct: boolean
}

export interface ManagedQuestion {
  uid: string
  question_text: string
  marks: number
  order_index: number
  options: QuestionOption[]
}

export interface QuestionPayload {
  question_text: string
  marks: number
  options: string[]
  correct_answer: string
  order_index?: number
}
