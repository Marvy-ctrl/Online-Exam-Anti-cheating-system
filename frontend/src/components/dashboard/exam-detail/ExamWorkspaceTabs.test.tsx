import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExamWorkspaceTabs } from './ExamWorkspaceTabs'

describe('ExamWorkspaceTabs', () => {
  it('reports the selected workspace tab', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ExamWorkspaceTabs activeTab="overview" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Enrolled Students' }))

    expect(onChange).toHaveBeenCalledWith('enrolled')
  })
})
