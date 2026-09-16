'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/src/lib/api'
import type { SessionAuditDetails } from '@/src/types/session-audit'

export function useSessionAudit(sessionUid: string) {
  const [details, setDetails] = useState<SessionAuditDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    if (!sessionUid) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await apiFetch(`/exam_session/session/${sessionUid}/details`)
        if (response.ok) setDetails(await response.json())
        else {
          const body = await response.json().catch(() => ({}))
          setError(body.detail || `Server error (${response.status})`)
        }
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : 'Network error')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [sessionUid])

  const sendResult = useCallback(async () => {
    if (!sessionUid || sendingEmail) return
    setSendingEmail(true)
    try {
      const response = await apiFetch(`/exam_session/session/${sessionUid}/send-result`, { method: 'POST' })
      if (response.ok) {
        setEmailSent(true)
        window.setTimeout(() => setEmailSent(false), 5000)
      } else {
        const body = await response.json()
        alert(body.detail ? JSON.stringify(body.detail) : 'Failed to send email')
      }
    } catch {
      alert('Network error while sending email')
    } finally {
      setSendingEmail(false)
    }
  }, [sendingEmail, sessionUid])

  return { details, emailSent, error, loading, sendResult, sendingEmail }
}
