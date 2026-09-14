import { useCallback, useState } from 'react'
import { examSessionUrl } from '@/src/lib/exam-api'
import type {
  AnswerState,
  ExamIdentity,
  SaveStatus,
} from '@/src/types/exam'

export function restoreSavedAnswers(savedAnswers: Record<string, string[]>) {
  const restored: AnswerState = {}
  for (const [questionUid, optionUids] of Object.entries(savedAnswers)) {
    if (optionUids.length > 0) restored[questionUid] = optionUids[0]
  }
  return restored
}

export function useAnswerSync(identity: ExamIdentity) {
  const [answers, setAnswers] = useState<AnswerState>({})
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})

  const selectOption = useCallback(
    async (questionUid: string, optionUid: string, sessionUid: string) => {
      setAnswers((current) => ({ ...current, [questionUid]: optionUid }))
      setSaveStatus((current) => ({ ...current, [questionUid]: 'saving' }))

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(
            examSessionUrl(identity, `/questions/${questionUid}/answer`),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                exam_session_uid: sessionUid,
                selected_option_uids: [optionUid],
              }),
            },
          )
          if (response.ok) {
            setSaveStatus((current) => ({
              ...current,
              [questionUid]: 'idle',
            }))
            return
          }
        } catch {
          // Retry transient network failures below.
        }
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 500))
        }
      }

      setSaveStatus((current) => ({ ...current, [questionUid]: 'error' }))
    },
    [identity],
  )

  return { answers, saveStatus, selectOption, setAnswers }
}
