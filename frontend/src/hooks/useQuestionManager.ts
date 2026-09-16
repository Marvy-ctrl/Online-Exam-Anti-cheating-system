"use client"

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/src/lib/api'
import type { ManagedQuestion, QuestionPayload } from '@/src/types/question-manager'

export function useQuestionManager(examUid: string) {
  const [questions, setQuestions] = useState<ManagedQuestion[]>([])
  const [selectedUids, setSelectedUids] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`/questions/${examUid}`)
      if (!response.ok) {
        setError('Failed to load questions.')
        return
      }
      const data = await response.json()
      setQuestions(data.questions || [])
    } catch {
      setError('An error occurred while fetching questions.')
    } finally {
      setLoading(false)
    }
  }, [examUid])

  useEffect(() => {
    void fetchQuestions()
  }, [fetchQuestions])

  const saveQuestion = async (payload: QuestionPayload, questionUid?: string) => {
    setLoading(true)
    try {
      const response = await apiFetch(
        questionUid ? `/questions/${questionUid}` : `/questions/${examUid}/upload`,
        {
          method: questionUid ? 'PATCH' : 'POST',
          body: JSON.stringify(questionUid ? payload : [{ ...payload, order_index: questions.length + 1 }]),
        },
      )
      if (!response.ok) {
        const data = await response.json()
        setError(data.detail || `Failed to ${questionUid ? 'update' : 'add'} question`)
        return false
      }
      setSuccess(`Question ${questionUid ? 'updated' : 'added'} successfully!`)
      await fetchQuestions()
      return true
    } catch {
      setError('An error occurred.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const uploadQuestions = async (questionsData: unknown[]) => {
    setLoading(true)
    try {
      const response = await apiFetch(`/questions/${examUid}/upload`, {
        method: 'POST',
        body: JSON.stringify(questionsData),
      })
      if (!response.ok) {
        const data = await response.json()
        setError(data.detail || 'Failed to upload questions')
        return false
      }
      setSuccess('Questions uploaded successfully!')
      await fetchQuestions()
      return true
    } catch {
      setError('An error occurred.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteQuestion = async (uid: string) => {
    if (!window.confirm('Delete this question?')) return
    try {
      const response = await apiFetch(`/questions/${uid}`, { method: 'DELETE' })
      if (response.ok) {
        setQuestions((current) => current.filter((question) => question.uid !== uid))
        setSelectedUids((current) => current.filter((id) => id !== uid))
        setSuccess('Question deleted.')
      }
    } catch {
      setError('Failed to delete question.')
    }
  }

  const deleteSelectedQuestions = async () => {
    if (selectedUids.length === 0) return
    if (!window.confirm(`Delete ${selectedUids.length} selected questions?`)) return
    setLoading(true)
    try {
      const response = await apiFetch('/questions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ question_uids: selectedUids }),
      })
      if (!response.ok) {
        setError('Failed to delete questions.')
        return
      }
      setSuccess(`Successfully deleted ${selectedUids.length} questions.`)
      setQuestions((current) => current.filter((question) => !selectedUids.includes(question.uid)))
      setSelectedUids([])
    } catch {
      setError('An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const toggleQuestion = (uid: string) => {
    setSelectedUids((current) =>
      current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid],
    )
  }

  const toggleAllQuestions = () => {
    setSelectedUids((current) =>
      current.length === questions.length ? [] : questions.map((question) => question.uid),
    )
  }

  return {
    questions,
    selectedUids,
    loading,
    error,
    success,
    clearError: () => setError(''),
    clearSuccess: () => setSuccess(''),
    setError,
    saveQuestion,
    uploadQuestions,
    deleteQuestion,
    deleteSelectedQuestions,
    toggleQuestion,
    toggleAllQuestions,
  }
}
