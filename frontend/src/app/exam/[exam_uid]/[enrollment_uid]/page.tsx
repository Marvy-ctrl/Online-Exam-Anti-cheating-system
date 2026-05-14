"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, Camera, CheckCircle, Clock, Loader2, Send, ShieldAlert, X } from 'lucide-react'

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/v1`

interface Option { uid: string; option_text: string; order_index: number }
interface Question { uid: string; question_text: string; order_index: number; options: Option[] }
interface ExamData {
  exam_uid: string; session_uid: string
  questions: Question[]
  student_first_name: string
  student_last_name: string
  student_id: string
  saved_answers: Record<string, string[]>
}

type AnswerState = Record<string, string>   // question_uid → selected option_uid
type SaveStatus = 'idle' | 'saving' | 'error'

export default function ExamPage() {
  const params = useParams()
  const router = useRouter()
  const { exam_uid, enrollment_uid } = params as { exam_uid: string; enrollment_uid: string }

  const [loading, setLoading] = useState(true)
  const [examData, setExamData] = useState<ExamData | null>(null)
  const [answers, setAnswers] = useState<AnswerState>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [error, setError] = useState('')

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null)  // seconds
  const expectedEndRef = useRef<Date | null>(null)

  // Submit
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedAt, setSubmittedAt] = useState('')

  // Webcam
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const [faceStatus, setFaceStatus] = useState<'ok' | 'warning' | 'checking'>('checking')
  const [nextCheckIn, setNextCheckIn] = useState(60)
  const faceCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const faceCheckCountdown = useRef<NodeJS.Timeout | null>(null)

  // Violations
  const [violationBanner, setViolationBanner] = useState('')
  const tabSwitchCount = useRef(0)

  // WebSocket State
  const wsRef = useRef<WebSocket | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/exam_session/${exam_uid}/student/${enrollment_uid}/questions`,
          { credentials: 'include' }
        )
        if (res.status === 409) {
          setSubmitted(true)
          setLoading(false)
          return
        }
        if (!res.ok) {
          const err = await res.json()
          setError(err.detail || 'Failed to load exam.')
          setLoading(false)
          return
        }
        const data: ExamData = await res.json()
        setExamData(data)

        // Restore saved answers
        const restored: AnswerState = {}
        for (const [qUid, optUids] of Object.entries(data.saved_answers)) {
          if (optUids.length > 0) restored[qUid] = optUids[0]
        }
        setAnswers(restored)

        // Fetch session expected_end_time
        await fetchSessionTiming(data.session_uid)
      } catch (e) {
        setError('Failed to connect to the exam server.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [exam_uid, enrollment_uid])

  const fetchSessionTiming = async (sessionUid: string) => {
    // Start timer: re-call start and read expected_end_time from response cookie/body
    // We stored expected_end_time from start — use a workaround by re-fetching questions
    // and checking if session is still active. Actual end time: we'll derive from
    // calling the start endpoint again — but since session exists, it returns 409.
    // Instead we compute from the initial start call. Since we can't re-call start,
    // we check session info from the questions response.
    // The timer is set client-side using expected_end_time from initial start.
    // If page is refreshed, we lose expected_end_time — so we use current time + remaining.
    // For now: we store expected_end_time in sessionStorage on first start.
    const stored = sessionStorage.getItem(`exam_end_${exam_uid}_${enrollment_uid}`)
    if (stored) {
      expectedEndRef.current = new Date(stored)
    }
    // If not stored, we can't recover end time without a new endpoint — timer will be null
  }

  // ─── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!expectedEndRef.current) return
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expectedEndRef.current!.getTime() - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        triggerAutoSubmit()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [examData])

  const triggerAutoSubmit = useCallback(async () => {
    if (submitted || isSubmitting) return
    await submitExam()
  }, [submitted, isSubmitting])

  // ─── WebSocket Monitoring Connection ────────────────────────────────────
  useEffect(() => {
    if (!examData || submitted) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = process.env.NEXT_PUBLIC_BACKEND_URL 
      ? process.env.NEXT_PUBLIC_BACKEND_URL.replace('http://', '').replace('https://', '')
      : 'localhost:8000'
    const wsUrl = `${protocol}//${host}/api/v1/exam_session/${exam_uid}/student/${enrollment_uid}/ws`
    
    console.log("Monitoring system connecting to:", wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }))
    }
    ws.onclose = () => setWsConnected(false)
    ws.onerror = (e) => console.error("WS Connection Error", e)

    return () => ws.close()
  }, [examData, submitted, exam_uid, enrollment_uid])

  const sendWsViolation = (type: string, message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'violation',
        violation_type: type,
        message,
        timestamp: new Date().toISOString()
      }))
    }
  }

  // ─── Webcam ──────────────────────────────────────────────────────────────
  // Effect 1: acquire the media stream (independent of DOM)
  useEffect(() => {
    const acquire = async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 },
        })
        setWebcamStream(ms)
      } catch {
        setViolationBanner('Camera not accessible. Continuous monitoring disabled.')
      }
    }
    acquire()
    return () => stopWebcam()
  }, [])

  // Effect 2: attach stream to the <video> element once BOTH are ready
  useEffect(() => {
    if (!webcamStream || !videoRef.current) return
    videoRef.current.srcObject = webcamStream
  }, [webcamStream])

  const stopWebcam = () => {
    if (webcamStream) webcamStream.getTracks().forEach(t => t.stop())
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    if (faceCheckInterval.current) clearInterval(faceCheckInterval.current)
    if (faceCheckCountdown.current) clearInterval(faceCheckCountdown.current)
  }

  // Periodic face check every 20 seconds
  useEffect(() => {
    if (!webcamStream || !examData) return

    setNextCheckIn(20)
    faceCheckCountdown.current = setInterval(() => {
      setNextCheckIn(prev => {
        if (prev <= 1) return 20
        return prev - 1
      })
    }, 1000)

    faceCheckInterval.current = setInterval(() => {
      captureFaceForCheck()
    }, 20000)

    return () => {
      if (faceCheckInterval.current) clearInterval(faceCheckInterval.current)
      if (faceCheckCountdown.current) clearInterval(faceCheckCountdown.current)
    }
  }, [webcamStream, examData])

  const captureFaceForCheck = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !examData) return

    // Guard: video must be streaming real frames before we capture
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Face check skipped: video not ready yet')
      return
    }

    setFaceStatus('checking')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1]

    try {
      const res = await fetch(`${BASE_URL}/exam_session/${exam_uid}/student/${enrollment_uid}/verify-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ face_image: base64 }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setFaceStatus('ok')
      } else {
        setFaceStatus('warning')
        setViolationBanner(`Face check failed: ${data.message}`)
        sendWsViolation(data.violation_type || 'face_check_failed', data.message)
        setTimeout(() => setViolationBanner(''), 5000)
      }
    } catch {
      setFaceStatus('warning')
    }
  }

  // ─── Tab switch detection ────────────────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.hidden) {
        tabSwitchCount.current += 1
        setViolationBanner(`You left the exam tab — this has been noted (${tabSwitchCount.current}× detected)`)
        setTimeout(() => setViolationBanner(''), 6000)
        
        try {
          const url = `${BASE_URL}/exam_session/${exam_uid}/student/${enrollment_uid}/violation`
          console.log("Logging tab switch to:", url)
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ violation_type: 'tab_switch', count: tabSwitchCount.current }),
          })
          if (res.ok) {
            sendWsViolation('tab_switch', `Student switched tabs (${tabSwitchCount.current}×)`)
          } else {
            console.error("Failed to log tab switch (Server error):", res.status)
          }
        } catch (e) { console.error("Failed to log tab switch (Network error):", e) }
      }
    }
    const onBlur = async () => {
      setViolationBanner('Exam window lost focus — please stay on this page')
      setTimeout(() => setViolationBanner(''), 4000)

      try {
        const url = `${BASE_URL}/exam_session/${exam_uid}/student/${enrollment_uid}/violation`
        console.log("🚀 Logging focus loss to:", url)
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ violation_type: 'focus_loss', count: 1 }),
        })
        if (res.ok) {
          sendWsViolation('focus_loss', 'Exam window lost focus')
        } else {
          console.error("Failed to log focus loss (Server error):", res.status)
        }
      } catch (e) { console.error("Failed to log focus loss (Network error):", e) }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    return () => document.removeEventListener('contextmenu', block)
  }, [])

  const selectOption = async (questionUid: string, optionUid: string, sessionUid: string) => {
    setAnswers(prev => ({ ...prev, [questionUid]: optionUid }))
    setSaveStatus(prev => ({ ...prev, [questionUid]: 'saving' }))

    let attempt = 0
    while (attempt < 3) {
      try {
        const res = await fetch(
          `${BASE_URL}/exam_session/${exam_uid}/student/${enrollment_uid}/questions/${questionUid}/answer`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              exam_session_uid: sessionUid,
              selected_option_uids: [optionUid],
            }),
          }
        )
        if (res.ok) {
          setSaveStatus(prev => ({ ...prev, [questionUid]: 'idle' }))
          return
        }
      } catch { /* retry */ }
      attempt++
      await new Promise(r => setTimeout(r, 500))
    }
    // All retries failed
    setSaveStatus(prev => ({ ...prev, [questionUid]: 'error' }))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  const submitExam = async () => {
    if (isSubmitting || submitted) return
    setIsSubmitting(true)
    setShowSubmitModal(false)
    try {
      const res = await fetch(
        `${BASE_URL}/exam_session/${exam_uid}/student/${enrollment_uid}/submit_answers`,
        { method: 'POST', credentials: 'include' }
      )
      if (res.ok) {
        const data = await res.json()
        setSubmitted(true)
        setSubmittedAt(data.submitted_time)
        stopWebcam()
      } else {
        const err = await res.json()
        setViolationBanner(`Submission failed: ${err.detail}`)
        setTimeout(() => setViolationBanner(''), 5000)
      }
    } catch {
      setViolationBanner('Network error during submission. Please try again.')
      setTimeout(() => setViolationBanner(''), 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatTime = (secs: number | null) => {
    if (secs === null) return '--:--:--'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
  }

  const timerColor = () => {
    if (timeLeft === null) return 'text-slate-400'
    const total = (examData?.questions.length ?? 1) * 60
    const pct = timeLeft / (total || 1)
    if (pct < 0.10) return 'text-red-400'
    if (pct < 0.20) return 'text-amber-400'
    return 'text-green-400'
  }

  const answeredCount = Object.keys(answers).length
  const totalCount = examData?.questions.length ?? 0

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-10 text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Exam Submitted!</h1>
          <p className="text-slate-400 mb-6">Your answers have been securely recorded.</p>
          {submittedAt && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-sm">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Submitted at</div>
              <div className="text-white font-semibold">{new Date(submittedAt).toLocaleString()}</div>
            </div>
          )}
          <p className="text-slate-400 text-sm">You may close this window. Good luck with your results!</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-slate-400">Loading exam...</p>
        </div>
      </div>
    )
  }

  if (error || !examData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="w-full max-w-md text-center">
          <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-semibold mb-2">Cannot load exam</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const currentQuestion = examData.questions[currentIdx]

  // ─── Main exam interface ──────────────────────────────────────────────────
  return (
    <div
      className="h-screen flex flex-col bg-white text-slate-900 overflow-hidden select-none"
      onCopy={e => e.preventDefault()}
    >
      {/* Violation banner */}
      {violationBanner && (
        <div className="bg-red-600/90 text-white text-sm font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 z-50">
          <ShieldAlert size={16} /> {violationBanner}
          <button onClick={() => setViolationBanner('')} className="ml-2"><X size={14} /></button>
        </div>
      )}

      {/* Top bar */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
               <span className="font-bold text-slate-900">{examData.student_first_name} {examData.student_last_name}</span>
               <span className="text-slate-300">|</span>
               <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{examData.student_id}</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
               Exam ID: {examData.exam_uid.split('-')[0]} • {totalCount} Questions
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 font-mono text-xl font-bold px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl ${timerColor()}`}>
            <Clock size={18} />
            {formatTime(timeLeft)}
          </div>
          <button
            id="submit-exam-btn"
            onClick={() => setShowSubmitModal(true)}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <Send size={14} /> Finish Exam
          </button>
        </div>
      </header>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Navigator */}
        <aside className="w-64 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-slate-200 bg-white">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Question Navigator</div>
            <div className="flex items-center gap-2">
               <div className="text-sm font-bold text-slate-900">{answeredCount}</div>
               <div className="text-xs text-slate-400">of {totalCount} answered</div>
            </div>
          </div>
          <div className="p-4 grid grid-cols-4 gap-2.5">
            {examData.questions.map((q, i) => {
              const isAnswered = !!answers[q.uid]
              const isCurrent = i === currentIdx
              return (
                <button
                  key={q.uid}
                  id={`nav-q-${i + 1}`}
                  onClick={() => setCurrentIdx(i)}
                  className={`w-full aspect-square rounded-xl text-xs font-bold transition-all border ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                      : isAnswered
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          <div className="p-5 mt-auto border-t border-slate-200 bg-white space-y-3">
            <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
              <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200" /> Answered
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
              <div className="w-3 h-3 rounded bg-white border border-slate-200" /> Unanswered
            </div>
          </div>
        </aside>

        {/* CENTER — Question */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            {/* Question number + text */}
            <div className="mb-8">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                Question {currentIdx + 1} of {totalCount}
              </div>
              <p className="text-xl text-slate-900 leading-relaxed font-semibold">
                {currentQuestion.question_text}
              </p>
              {saveStatus[currentQuestion.uid] === 'error' && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle size={12} /> Failed to save — will retry on next selection
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-4">
              {currentQuestion.options.map((opt, oi) => {
                const isSelected = answers[currentQuestion.uid] === opt.uid
                const letter = String.fromCharCode(65 + oi)
                return (
                  <button
                    key={opt.uid}
                    id={`opt-${currentIdx + 1}-${letter}`}
                    onClick={() => selectOption(currentQuestion.uid, opt.uid, examData.session_uid)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-start gap-4 group ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-900'
                        : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-slate-50 shadow-sm'
                    }`}
                  >
                    <span className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                      isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}>
                      {letter}
                    </span>
                    <span className="text-base font-medium leading-relaxed pt-1">{opt.option_text}</span>
                    {isSelected && <CheckCircle size={20} className="shrink-0 ml-auto text-blue-500 mt-1" />}
                  </button>
                )
              })}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-12 pt-8 border-t border-slate-100">
              <button
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                ← Back
              </button>
              {currentIdx < totalCount - 1 ? (
                <button
                  onClick={() => setCurrentIdx(i => i + 1)}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                >
                  Next Question →
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-green-600/20 flex items-center gap-2"
                >
                  <Send size={16} /> Finish Exam
                </button>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT — Webcam */}
        <aside className="w-72 shrink-0 bg-slate-50 border-l border-slate-200 flex flex-col p-6 gap-6">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live Monitoring</div>
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3] shadow-lg ring-1 ring-slate-200">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              {/* Status overlay hidden from student */}
              {/* <div className={`absolute bottom-3 left-3 right-3 flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-xl backdrop-blur-md ${
                faceStatus === 'ok' ? 'bg-green-600/90 text-white'
                : faceStatus === 'warning' ? 'bg-red-600/90 text-white'
                : 'bg-slate-800/90 text-slate-100'
              }`}>
                {faceStatus === 'ok' ? <><CheckCircle size={12} /> Identity Verified</>
                : faceStatus === 'warning' ? <><AlertTriangle size={12} /> Alert Triggered</>
                : <><Loader2 size={12} className="animate-spin" /> Analyzing...</>}
              </div> */}
            </div>
          </div>

          {/* Integrity scan hidden from student */}
          {/* <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Integrity Scan</div>
            <div className="font-mono text-2xl text-blue-600 font-black tracking-tighter">{String(nextCheckIn).padStart(2, '0')}s</div>
            <div className="text-[9px] text-slate-400 mt-2 font-medium">Automatic facial verification active</div>
          </div> */}

          {/* Exam stats */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Progress</div>
                <div className="text-slate-900 font-black text-lg">{answeredCount}/{totalCount}</div>
              </div>
              <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                 {totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0}%
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={isSubmitting}
            className="mt-auto w-full py-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {isSubmitting ? 'Finalizing...' : 'Submit Final Script'}
          </button>
        </aside>
      </div>

      {/* Submit modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
            
              <h2 className="text-xl font-bold text-white mb-2">Submit Your Exam?</h2>
              <p className="text-slate-400 text-sm">This action cannot be undone.</p>
            </div>

            {answeredCount < totalCount && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-sm text-amber-300 text-center">
                ⚠️ You have <strong>{totalCount - answeredCount}</strong> unanswered question{totalCount - answeredCount !== 1 ? 's' : ''}.
                Unanswered questions will receive no marks.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors"
              >
                Continue Exam
              </button>
              <button
                id="confirm-submit-btn"
                onClick={submitExam}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
