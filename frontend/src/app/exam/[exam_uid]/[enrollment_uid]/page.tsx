'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ExamHeader } from '@/src/components/exam/ExamHeader'
import {
  ExamLoadError,
  ExamLoading,
  ExamSubmitted,
  SubmitModal,
  ViolationBanner,
} from '@/src/components/exam/ExamOverlays'
import {
  MobileMonitorStrip,
  ProctoringSidebar,
} from '@/src/components/exam/ProctoringPanels'
import { QuestionDisplay } from '@/src/components/exam/QuestionDisplay'
import { QuestionNavigator } from '@/src/components/exam/QuestionNavigator'
import {
  restoreSavedAnswers,
  useAnswerSync,
} from '@/src/hooks/exam/useAnswerSync'
import { useBrowserViolations } from '@/src/hooks/exam/useBrowserViolations'
import { useExamTimer } from '@/src/hooks/exam/useExamTimer'
import { useExamWebSocket } from '@/src/hooks/exam/useExamWebSocket'
import { useWebcamMonitor } from '@/src/hooks/exam/useWebcamMonitor'
import { examSessionUrl } from '@/src/lib/exam-api'
import type { ExamData, ExamIdentity } from '@/src/types/exam'

export default function ExamPage() {
  const { exam_uid: examUid, enrollment_uid: enrollmentUid } = useParams<{
    exam_uid: string
    enrollment_uid: string
  }>()
  const identity: ExamIdentity = useMemo(
    () => ({ examUid, enrollmentUid }),
    [examUid, enrollmentUid],
  )

  const [loading, setLoading] = useState(true)
  const [examData, setExamData] = useState<ExamData | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState('')
  const [violationBanner, setViolationBanner] = useState('')
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedAt, setSubmittedAt] = useState('')

  const { answers, saveStatus, selectOption, setAnswers } = useAnswerSync(identity)
  const monitoringEnabled = Boolean(examData) && !submitted
  const { connected, sendViolation } = useExamWebSocket(
    identity,
    monitoringEnabled,
  )
  const showCameraUnavailable = useCallback(() => {
    setViolationBanner('Camera not accessible. Continuous monitoring disabled.')
  }, [])
  const {
    canvasRef,
    desktopVideoRef,
    faceStatus,
    mobileVideoRef,
    nextCheckIn,
    stopWebcam,
  } = useWebcamMonitor({
    enabled: monitoringEnabled,
    identity,
    onCameraUnavailable: showCameraUnavailable,
    sendViolation,
  })

  useBrowserViolations({
    enabled: monitoringEnabled,
    identity,
    sendViolation,
  })

  useEffect(() => {
    const controller = new AbortController()

    const fetchExam = async () => {
      try {
        const response = await fetch(examSessionUrl(identity, '/questions'), {
          credentials: 'include',
          signal: controller.signal,
        })
        if (response.status === 409) {
          setSubmitted(true)
          return
        }
        if (!response.ok) {
          const result = await response.json()
          setError(result.detail || 'Failed to load exam.')
          return
        }
        const result: ExamData = await response.json()
        setExamData(result)
        setAnswers(restoreSavedAnswers(result.saved_answers))
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') {
          setError('Failed to connect to the exam server.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void fetchExam()
    return () => controller.abort()
  }, [identity, setAnswers])

  const showTemporaryViolation = useCallback((message: string) => {
    setViolationBanner(message)
    window.setTimeout(() => setViolationBanner(''), 5000)
  }, [])

  const submitExam = useCallback(async () => {
    if (isSubmitting || submitted) return
    setIsSubmitting(true)
    setSubmitModalOpen(false)
    try {
      const response = await fetch(examSessionUrl(identity, '/submit_answers'), {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const result = await response.json()
        setSubmitted(true)
        setSubmittedAt(result.submitted_time)
        stopWebcam()
      } else {
        const result = await response.json()
        showTemporaryViolation(`Submission failed: ${result.detail}`)
      }
    } catch {
      showTemporaryViolation('Network error during submission. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    identity,
    isSubmitting,
    showTemporaryViolation,
    stopWebcam,
    submitted,
  ])

  const timeLeft = useExamTimer({
    enabled: Boolean(examData) && !submitted,
    expectedEndTime: examData?.expected_end_time,
    storageKey: `exam_end_${examUid}_${enrollmentUid}`,
    onExpire: () => void submitExam(),
  })

  if (submitted) return <ExamSubmitted submittedAt={submittedAt} />
  if (loading) return <ExamLoading />
  if (error || !examData) return <ExamLoadError message={error} />
  if (examData.questions.length === 0) {
    return <ExamLoadError message="This exam has no questions." />
  }

  const currentQuestion = examData.questions[currentIndex]
  const answeredCount = Object.keys(answers).length
  const totalCount = examData.questions.length

  return (
    <div
      className="h-screen flex flex-col bg-white text-slate-900 overflow-hidden select-none"
      onCopy={(event) => event.preventDefault()}
    >
      <ViolationBanner
        message={violationBanner}
        onDismiss={() => setViolationBanner('')}
      />
      <ExamHeader
        exam={examData}
        isSubmitting={isSubmitting}
        onOpenNavigator={() => setNavigatorOpen(true)}
        onOpenSubmit={() => setSubmitModalOpen(true)}
        timeLeft={timeLeft}
      />
      <MobileMonitorStrip
        answeredCount={answeredCount}
        canvasRef={canvasRef}
        exam={examData}
        faceStatus={faceStatus}
        totalCount={totalCount}
        videoRef={mobileVideoRef}
      />

      <div className="flex flex-1 overflow-hidden">
        <QuestionNavigator
          answers={answers}
          currentIndex={currentIndex}
          drawerOpen={navigatorOpen}
          onCloseDrawer={() => setNavigatorOpen(false)}
          onOpenSubmit={() => setSubmitModalOpen(true)}
          onSelectQuestion={setCurrentIndex}
          questions={examData.questions}
        />
        <QuestionDisplay
          answers={answers}
          currentIndex={currentIndex}
          onOpenSubmit={() => setSubmitModalOpen(true)}
          onSelectOption={(questionUid, optionUid) =>
            void selectOption(questionUid, optionUid, examData.session_uid)
          }
          onSelectQuestion={setCurrentIndex}
          question={currentQuestion}
          saveStatus={saveStatus[currentQuestion.uid]}
          totalQuestions={totalCount}
        />
        <ProctoringSidebar
          answeredCount={answeredCount}
          faceStatus={faceStatus}
          isSubmitting={isSubmitting}
          nextCheckIn={nextCheckIn}
          onOpenSubmit={() => setSubmitModalOpen(true)}
          totalCount={totalCount}
          videoRef={desktopVideoRef}
          websocketConnected={connected}
        />
      </div>

      <SubmitModal
        answeredCount={answeredCount}
        isSubmitting={isSubmitting}
        onCancel={() => setSubmitModalOpen(false)}
        onConfirm={() => void submitExam()}
        open={submitModalOpen}
        totalCount={totalCount}
      />
    </div>
  )
}
