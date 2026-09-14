import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/src/lib/api'
import type { ExamResult, ToastMessage } from '@/src/types/admin-exam'

export function useExamResults(examUid: string) {
  const [results, setResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSessionUids, setSelectedSessionUids] = useState<Set<string>>(
    new Set(),
  )
  const [scoreSession, setScoreSession] = useState<ExamResult | null>(null)
  const [newScore, setNewScore] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [updatingScore, setUpdatingScore] = useState(false)
  const [releaseMode, setReleaseMode] = useState<'single' | 'bulk'>('bulk')
  const [releaseTarget, setReleaseTarget] = useState<{
    sessionUid: string
    studentName: string
  } | null>(null)
  const [releaseModalOpen, setReleaseModalOpen] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = useCallback(
    (message: string, type: ToastMessage['type'] = 'success') => {
      setToast({ message, type })
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 4000)
    },
    [],
  )

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`/exam_session/${examUid}/results`)
      if (response.ok) {
        setResults(await response.json())
      } else {
        showToast('Failed to load exam results.', 'error')
      }
    } catch {
      showToast('Could not connect to the results service.', 'error')
    } finally {
      setLoading(false)
    }
  }, [examUid, showToast])

  useEffect(() => {
    void fetchResults()
  }, [fetchResults])

  const toggleSession = useCallback((sessionUid: string) => {
    setSelectedSessionUids((current) => {
      const next = new Set(current)
      if (next.has(sessionUid)) next.delete(sessionUid)
      else next.add(sessionUid)
      return next
    })
  }, [])

  const toggleAllSessions = useCallback(() => {
    setSelectedSessionUids((current) =>
      current.size === results.length
        ? new Set()
        : new Set(results.map((result) => result.session_uid)),
    )
  }, [results])

  const openScoreEditor = useCallback((result: ExamResult) => {
    setScoreSession(result)
    setNewScore(result.score?.toString() || '')
    setAdjustmentReason(result.adjustment_reason || '')
  }, [])

  const updateScore = useCallback(async () => {
    if (!scoreSession) return
    setUpdatingScore(true)
    try {
      const response = await apiFetch(
        `/exam_session/session/${scoreSession.session_uid}/update-score`,
        {
          method: 'POST',
          body: JSON.stringify({
            new_score: Number.parseFloat(newScore),
            adjustment_reason: adjustmentReason,
          }),
        },
      )
      if (response.ok) {
        setScoreSession(null)
        showToast('Score updated successfully.')
        await fetchResults()
      } else {
        showToast('Failed to update score.', 'error')
      }
    } catch {
      showToast('Could not connect to the score service.', 'error')
    } finally {
      setUpdatingScore(false)
    }
  }, [adjustmentReason, fetchResults, newScore, scoreSession, showToast])

  const openSingleRelease = useCallback(
    (sessionUid: string, studentName: string) => {
      setReleaseMode('single')
      setReleaseTarget({ sessionUid, studentName })
      setReleaseModalOpen(true)
    },
    [],
  )

  const openBulkRelease = useCallback(() => {
    setReleaseMode('bulk')
    setReleaseTarget(null)
    setReleaseModalOpen(true)
  }, [])

  const confirmRelease = useCallback(async () => {
    setReleasing(true)
    try {
      const isBulk = releaseMode === 'bulk'
      const response = isBulk
        ? await apiFetch('/exam_session/bulk-send-results', {
            method: 'POST',
            body: JSON.stringify({
              session_uids: Array.from(selectedSessionUids),
            }),
          })
        : await apiFetch(
            `/exam_session/session/${releaseTarget?.sessionUid}/send-result`,
            { method: 'POST' },
          )

      if (response.ok) {
        const releasedCount = selectedSessionUids.size
        setSelectedSessionUids(new Set())
        setReleaseModalOpen(false)
        showToast(
          isBulk
            ? `Successfully released results to ${releasedCount} student(s)!`
            : `Successfully released result to ${releaseTarget?.studentName}!`,
        )
        await fetchResults()
      } else {
        const result = await response.json()
        showToast(result.detail || 'Failed to release results.', 'error')
      }
    } catch {
      showToast('Could not connect to the result delivery service.', 'error')
    } finally {
      setReleasing(false)
    }
  }, [
    fetchResults,
    releaseMode,
    releaseTarget,
    selectedSessionUids,
    showToast,
  ])

  return {
    adjustmentReason,
    closeReleaseModal: () => setReleaseModalOpen(false),
    closeScoreEditor: () => setScoreSession(null),
    confirmRelease,
    dismissToast: () => setToast(null),
    fetchResults,
    loading,
    newScore,
    openBulkRelease,
    openScoreEditor,
    openSingleRelease,
    releaseModalOpen,
    releaseMode,
    releaseTarget,
    releasing,
    results,
    scoreSession,
    selectedSessionUids,
    setAdjustmentReason,
    setNewScore,
    toast,
    toggleAllSessions,
    toggleSession,
    updateScore,
    updatingScore,
  }
}
