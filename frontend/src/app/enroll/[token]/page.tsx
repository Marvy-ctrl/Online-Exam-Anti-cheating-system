"use client"
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ShieldCheck, AlertCircle, CheckCircle, Loader2, Clock } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const BASE_URL =
  `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/v1`;

export default function StudentEnrollPage() {
  const params = useParams()
  const token = params.token as string

  // Initial link validation state
  const [linkStatus, setLinkStatus] = useState<'checking' | 'valid' | 'expired' | 'error' | 'not_yet_open'>('checking')
  const [linkMessage, setLinkMessage] = useState("")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [studentId, setStudentId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false)
  const [enrollmentUid, setEnrollmentUid] = useState("")

  useEffect(() => {
    const validateLink = async () => {
      try {
        const res = await fetch(`${BASE_URL}/student/enroll/${token}/validate`)
        if (res.ok) {
          const data = await res.json()
          
          if (typeof window !== 'undefined') {
            const enrolledExams = JSON.parse(localStorage.getItem('enrolled_exams') || '[]')
            if (enrolledExams.includes(data.exam_uid)) {
              setAlreadyEnrolled(true)
              setLinkStatus('valid')
              return
            }
          }
          
          setLinkStatus('valid')
        } else {
          const errData = await res.json()
          const detail = errData.detail || ""
          setLinkMessage(detail || "Enrollment link is invalid or expired.")
          
          if (detail.includes("not started yet")) {
            setLinkStatus('not_yet_open')
          } else {
            setLinkStatus('expired')
          }
        }
      } catch (err) {
        setLinkMessage("Network error confirming the link.")
        setLinkStatus('error')
      }
    }
    
    validateLink()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch(`${BASE_URL}/student/enroll/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email,
          student_id: studentId,
          device_id: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        })
      })

      if (res.ok) {
        const data = await res.json()
        setEnrollmentUid(data.uid)
        setSuccess(true)
      } else {
        const errData = await res.json()
        if (errData.detail && errData.detail.includes("already completed face registration")) {
          setAlreadyEnrolled(true)
        } else {
          setError(errData.detail || "Enrollment failed. Please check your details.")
        }
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  if (linkStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center p-8">
          <Loader2 size={32} className="animate-spin text-blue-600 mb-4" />
          <p className="text-slate-500 font-medium">Validating enrollment link...</p>
        </div>
      </div>
    )
  }

  if (linkStatus === 'expired' || linkStatus === 'error' || linkStatus === 'not_yet_open') {
    const isNotStarted = linkStatus === 'not_yet_open'
    const isError = linkStatus === 'error'

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isNotStarted ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            {isNotStarted ? (
              <Clock size={32} className="text-amber-600" />
            ) : isError ? (
              <AlertCircle size={32} className="text-red-600" />
            ) : (
              <Clock size={32} className="text-red-600" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isNotStarted ? 'Enrollment Not Started' : 'Link Invalid'}
          </h1>
          
          <p className="text-slate-500 mb-6 font-medium">
            {linkMessage}
          </p>

          <div className={`rounded-xl p-4 text-left text-sm ${
            isNotStarted ? 'bg-amber-50 border border-amber-100 text-amber-800' : 'bg-slate-50 border border-slate-200 text-slate-600'
          }`}>
            {isNotStarted ? (
              "This enrollment period has not yet begun. Please check the schedule provided by your lecturer and return once it is active."
            ) : (
              "This link is no longer valid. It may have expired or already been used. Please contact your lecturer to request a new enrollment link."
            )}
          </div>
        </div>
      </div>
    )
  }

  if (alreadyEnrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Already Enrolled</h1>
          <p className="text-slate-500 mb-6">
            Our records indicate that you have already successfully completed enrollment and face registration for this exam.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-sm text-slate-600">
            No further action is required from you. You are all set to take the exam on the scheduled date!
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          {/* <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          </div> */}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Details Verified!</h1>
          <p className="text-slate-500 mb-6">
            Your details have been verified successfully. 
            You now need to complete face registration to fully enroll.
          </p>
          
          
          <Link
            href={`/enroll/face-registration/${enrollmentUid}`}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            Continue to Face Registration
          </Link>
          
          <p className="text-xs text-slate-400 mt-4">
            You must complete this step to be fully enrolled for the exam.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Image 
              src="/examloc_logo.png" 
              alt="ExamLoc Logo" 
              width={150} 
              height={40} 
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Exam Enrollment</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Enter your registered details exactly as provided by your institution to verify your identity.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder=""
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Last Name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder=""
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=""
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Student / Reg Number</label>
            <input
              type="text"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="001"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Verify & Enroll
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-400 mt-4">
            Your details must match the records provided by your institution. 
            If enrollment fails, contact your examiner.
          </p>
        </form>
      </div>
    </div>
  )
}
