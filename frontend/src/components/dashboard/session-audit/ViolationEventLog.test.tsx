import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ViolationEventLog } from './ViolationEventLog'
import type { AuditViolation } from '@/src/types/session-audit'

const violations: AuditViolation[] = Array.from({ length: 7 }, (_, index) => ({
  type: 'tab_switch',
  time: `2026-09-16T14:00:0${index}.000Z`,
}))

describe('ViolationEventLog', () => {
  it('expands a truncated event list on request', async () => {
    const user = userEvent.setup()
    render(<ViolationEventLog violations={violations} />)

    expect(screen.getAllByText('Security violation logged.')).toHaveLength(6)
    await user.click(screen.getByRole('button', { name: 'Show All 7 Events' }))
    expect(screen.getAllByText('Security violation logged.')).toHaveLength(7)
  })
})
