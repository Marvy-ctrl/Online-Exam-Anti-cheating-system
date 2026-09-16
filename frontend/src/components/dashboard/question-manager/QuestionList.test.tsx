import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuestionList } from './QuestionList'
import type { ManagedQuestion } from '@/src/types/question-manager'

const question: ManagedQuestion = {
  uid: 'question-1',
  question_text: 'What is 2 + 2?',
  marks: 1,
  order_index: 1,
  options: [
    { uid: 'option-1', option_text: '4', is_correct: true },
    { uid: 'option-2', option_text: '5', is_correct: false },
  ],
}

describe('QuestionList', () => {
  it('reports selection and edit actions to its coordinator', async () => {
    const onToggleQuestion = vi.fn()
    const onEdit = vi.fn()
    const user = userEvent.setup()

    render(
      <QuestionList
        questions={[question]}
        selectedUids={[]}
        loading={false}
        editorOpen={false}
        bulkUploadOpen={false}
        onToggleQuestion={onToggleQuestion}
        onToggleAll={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Select question 1' }))
    await user.click(screen.getByTitle('Edit Question'))

    expect(onToggleQuestion).toHaveBeenCalledWith('question-1')
    expect(onEdit).toHaveBeenCalledWith(question)
  })
})
