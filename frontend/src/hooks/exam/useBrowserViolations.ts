import { useEffect, useRef } from 'react'
import { examSessionUrl } from '@/src/lib/exam-api'
import type { ExamIdentity } from '@/src/types/exam'

interface UseBrowserViolationsOptions {
  enabled: boolean
  identity: ExamIdentity
  sendViolation: (type: string, message: string) => void
}

export function useBrowserViolations({
  enabled,
  identity,
  sendViolation,
}: UseBrowserViolationsOptions) {
  const tabSwitchCount = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const reportViolation = async (violationType: string, count: number) => {
      try {
        await fetch(examSessionUrl(identity, '/violation'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({ violation_type: violationType, count }),
        })
      } catch {
        // WebSocket notification still provides immediate monitoring feedback.
      }
    }

    const onVisibilityChange = () => {
      if (!document.hidden) return
      tabSwitchCount.current += 1
      void reportViolation('tab_switch', tabSwitchCount.current)
      sendViolation(
        'tab_switch',
        `Student switched tabs (${tabSwitchCount.current}×)`,
      )
    }

    const onBlur = () => {
      void reportViolation('focus_loss', 1)
      sendViolation('focus_loss', 'Exam window lost focus')
    }

    const blockContextMenu = (event: MouseEvent) => event.preventDefault()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('contextmenu', blockContextMenu)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('contextmenu', blockContextMenu)
    }
  }, [enabled, identity, sendViolation])
}
