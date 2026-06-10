"use client"
import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Camera, AlertCircle, Loader2, Clock, ShieldCheck, CheckCircle, ArrowRight, RefreshCw } from 'lucide-react'
import Image from 'next/image'

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/v1`

interface ExamInfo {
  valid: boolean
  exam_uid: string
  exam_title: string
  exam_start_time: string
  exam_end_time: string
  duration_minutes: number
  status: 'open' | 'not_yet_open' | 'expired' | 'submitted'
  enrollment_uid?: string
}

type Phase = 'validating' | 'not_yet_open' | 'expired' | 'invalid' | 'identify' | 'face_capture' | 'verifying' | 'compliance' | 'done' | 'submitted'

export default function ExamEntryGatePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [phase, setPhase] = useState<Phase>('validating')
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null)
  const [error, setError] = useState('')
  const [enrollmentUid, setEnrollmentUid] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [isIdentifying, setIsIdentifying] = useState(false)
  const [checkedRules, setCheckedRules] = useState(false)
  const [checkedConsent, setCheckedConsent] = useState(false)

  // Countdown to exam start
  const [countdown, setCountdown] = useState('')

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Step 1: validate token
  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`${BASE_URL}/exam_session/enter/${token}/validate`)
        if (!res.ok) {
          setPhase('invalid')
          return
        }
        const data: ExamInfo = await res.json()
        setExamInfo(data)

        if (data.status === 'not_yet_open') {
          setPhase('not_yet_open')
          return
        }
        if (data.status === 'submitted') {
          setPhase('submitted')
          return
        }
        if (data.status === 'expired') {
          setPhase('expired')
          return
        }

        // Exam is open — find enrollment_uid from token (preferred) or localStorage (fallback)
        let uid = data.enrollment_uid

        if (!uid) {
          const enrolledMap: Record<string, string> = JSON.parse(localStorage.getItem('enrolled_exams_map') || '{}')
          uid = enrolledMap[data.exam_uid]
        }
        
        if (!uid) {
          setPhase('identify')
          return
        }

        setEnrollmentUid(uid)
        setPhase('face_capture')
        startCamera()
      } catch (e) {
        setPhase('invalid')
        setError('Could not validate the exam link. Check your connection.')
      }
    }
    validate()
    return () => stopCamera()
  }, [token])

  // Live countdown for not_yet_open
  useEffect(() => {
    if (phase !== 'not_yet_open' || !examInfo) return
    const tick = () => {
      const diff = new Date(examInfo.exam_start_time).getTime() - Date.now()
      if (diff <= 0) {
        window.location.reload()
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase, examInfo])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      setStream(mediaStream)
      if (videoRef.current) videoRef.current.srcObject = mediaStream
    } catch {
      setError('Camera access denied. Please allow camera access and refresh.')
    }
  }

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop())
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1]
    setCapturedImage(base64)
    stopCamera()
  }

  const retakePhoto = () => {
    setCapturedImage(null)
    setError('')
    startCamera()
  }

  const handleIdentify = async () => {
    if (!identifier.trim() || !examInfo) return
    setIsIdentifying(true)
    setError('')
    try {
      const res = await fetch(`${BASE_URL}/exam_session/${examInfo.exam_uid}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      })
      const data = await res.json()
      if (res.ok) {
        if (data.status === 'submitted') {
          setPhase('submitted')
          return
        }
        setEnrollmentUid(data.enrollment_uid)
        setPhase('face_capture')
        startCamera()
      } else {
        setError(data.detail || 'Could not identify your enrollment.')
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setIsIdentifying(false)
    }
  }

  const handleStartExam = async () => {
    if (!capturedImage || !examInfo) return
    setIsVerifying(true)
    setError('')
    try {
      const res = await fetch(
        `${BASE_URL}/exam_session/${examInfo.exam_uid}/student/${enrollmentUid}/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ face_image: capturedImage }),
        }
      )
      if (res.ok) {
        const data = await res.json()
        // Persist expected_end_time so the exam page timer survives a refresh
        sessionStorage.setItem(
          `exam_end_${examInfo.exam_uid}_${enrollmentUid}`,
          data.expected_end_time
        )
        setPhase('compliance')
      } else {
        const err = await res.json()
        // If session already exists, check if student already accepted instructions once
        if (res.status === 409) {
          const alreadyAccepted = localStorage.getItem(`compliance_accepted_${examInfo.exam_uid}_${enrollmentUid}`)
          if (alreadyAccepted === 'true') {
            setPhase('done')
            setTimeout(() => router.push(`/exam/${examInfo.exam_uid}/${enrollmentUid}`), 800)
          } else {
            // First time entry, but session was pre-created — show instructions!
            setPhase('compliance')
          }
          return
        }
        setError(err.detail || 'Face verification failed. Please try again.')
        setCapturedImage(null)
        startCamera()
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleEnterExamWithFullscreen = async () => {
    // Record that the student has read and consented to the instructions
    localStorage.setItem(`compliance_accepted_${examInfo!.exam_uid}_${enrollmentUid}`, 'true')
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } catch (e) {
      console.warn("Fullscreen request rejected or not supported:", e)
    }
    setPhase('done')
    setTimeout(() => {
      router.push(`/exam/${examInfo!.exam_uid}/${enrollmentUid}`)
    }, 800)
  }


  if (phase === 'validating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Validating exam link...</p>
        </div>
      </div>
    )
  }

  if (phase === 'not_yet_open' && examInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 text-center">
         
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Exam Not Yet Started</h1>
          <p className="text-slate-500 mb-6">
            <strong>{examInfo.exam_title}</strong> will open for entry at:
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Starts</div>
            <div className="text-slate-900 font-semibold">{new Date(examInfo.exam_start_time).toLocaleString()}</div>
          </div>
          <div className="text-3xl font-mono font-bold text-blue-600 mb-4">{countdown}</div>
          <p className="text-xs text-slate-400">This page will automatically refresh when the exam opens.</p>
        </div>
      </div>
    )
  }

  if (phase === 'identify' && examInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Image 
                src="/examloc_logo copy.png" 
                alt="ExamLoc Logo" 
                width={150} 
                height={40} 
                className="h-10 w-auto object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Identify Yourself</h1>
            <p className="text-slate-500">To start <strong>{examInfo.exam_title}</strong>, please enter your registered email or student ID.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email or Student ID</label>
              <input 
                type="text" 
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIdentify()}
                placeholder="e.g. student@example.com"
                className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button 
              onClick={handleIdentify}
              disabled={isIdentifying || !identifier.trim()}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isIdentifying ? <Loader2 size={18} className="animate-spin" /> : <>Next <ArrowRight size={18}/></>}
            </button>
            <p className="text-center text-[10px] text-slate-400 mt-4">
              Note: You must have completed face registration via your enrollment link to sit for this exam.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Exam Submitted</h1>
          <p className="text-slate-500 mb-6">
            You have already completed and submitted <strong>{examInfo?.exam_title}</strong>. 
            You cannot enter the exam again.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
            If you believe this is an error, please contact your examiner.
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Exam Period Has Ended</h1>
          <p className="text-slate-500">
            {examInfo?.exam_title} closed on {examInfo ? new Date(examInfo.exam_end_time).toLocaleString() : ''}. 
            Please contact your examiner if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Cannot Enter Exam</h1>
          <p className="text-slate-500">{error || 'This link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <p className="text-slate-700 font-semibold">Identity verified! Entering exam...</p>
        </div>
      </div>
    )
  }

  if (phase === 'compliance' && examInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Exam Rules & Proctoring Consent</h1>
            <p className="text-sm text-slate-500">
              {examInfo.exam_title} : Please read the anti-cheating guidelines carefully to prepare your secure workspace.
            </p>
          </div>

          {/* Rules List */}
          <div className="space-y-4 mb-8">
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm mb-1">1. Tab & Window Shifting</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Leaving the exam tab, opening new windows, or switching applications is strictly prohibited. 
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm mb-1">2. Continuous Face Proctoring</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your webcam stream must remain active and unobstructed. The presence of multiple faces, face mismatches, or camera absence will be recorded in the proctoring timeline.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm mb-1">3. Disconnection Policy</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                In the event of a brief network outage, your answers will continue to save locally. However, persistent disconnections or closing the browser without submitting may trigger an automatic exam closure.
              </p>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 mb-8 border-t border-slate-100 pt-6">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkedRules}
                onChange={(e) => setCheckedRules(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 focus:ring-0 accent-blue-600 outline-none cursor-pointer"
              />
              <span className="text-xs text-slate-600 font-medium leading-normal">
                I have read, understood, and agree to abide by all the listed proctoring regulations.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkedConsent}
                onChange={(e) => setCheckedConsent(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 focus:ring-0 accent-blue-600 outline-none cursor-pointer"
              />
              <span className="text-xs text-slate-600 font-medium leading-normal">
                I understand that my presence, browser focus, and webcam snapshots will be recorded for security auditing.
              </span>
            </label>
          </div>

          {/* Start CTA Button */}
          <button
            onClick={handleEnterExamWithFullscreen}
            disabled={!checkedRules || !checkedConsent}
            className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            Start Secure Exam Room
          </button>
        </div>
      </div>
    )
  }

  // Face capture phase
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-6">
            <Image 
              src="/examloc_logo copy.png" 
              alt="ExamLoc Logo" 
              width={150} 
              height={40} 
              className="h-10 w-auto object-contain brightness-0 invert"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Identity Verification</h1>
          <p className="text-slate-400 text-sm">
            {examInfo?.exam_title} - {examInfo?.duration_minutes} minutes
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {error && (
            <div className="m-4 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Camera view */}
          <div className="relative bg-black aspect-[4/3] flex items-center justify-center overflow-hidden">
            {!capturedImage ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
              <img src={`data:image/jpeg;base64,${capturedImage}`} alt="Captured" className="w-full h-full object-cover" />
            )}
            {/* Face guide oval */}
            {!capturedImage && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-56 border-2 border-dashed border-white/60 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
            )}
          </div>

          <div className="p-6">
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-center text-slate-400 text-xs mb-4">
              Look directly at the camera. Your face will be matched against your enrollment photo.
            </p>

            {!capturedImage ? (
              <button
                id="capture-face-btn"
                onClick={capturePhoto}
                disabled={!stream}
                className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Camera size={18} /> Capture My Face
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={retakePhoto}
                  disabled={isVerifying}
                  className="flex-1 py-3.5 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} /> Retake
                </button>
                <button
                  id="start-exam-btn"
                  onClick={handleStartExam}
                  disabled={isVerifying}
                  className="flex-1 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isVerifying
                    ? <><Loader2 size={16} className="animate-spin" /> Verifying...</>
                    : <><ArrowRight size={16} /> Enter Exam</>}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-4">
          By entering this exam you agree to be monitored via webcam throughout the session.
        </p>
      </div>
    </div>
  )
}
