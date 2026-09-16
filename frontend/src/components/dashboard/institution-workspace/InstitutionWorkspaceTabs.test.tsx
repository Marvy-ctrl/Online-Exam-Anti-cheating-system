import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InstitutionWorkspaceTabs } from './InstitutionWorkspaceTabs'

describe('InstitutionWorkspaceTabs', () => {
  it('reports the selected workspace tab', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<InstitutionWorkspaceTabs activeTab="exams" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Analytics' }))

    expect(onChange).toHaveBeenCalledWith('analytics')
  })
})
