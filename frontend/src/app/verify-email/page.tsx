"use client"
import React, { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShieldCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<{
    status: 'loading' | 'success' | 'error'
    message: string
  }>({ status: 'loading', message: '' })

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setState({ status: 'error', message: 'No verification token found. Please check your email link.' })
        return
      }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/v1/auth/verify-email?token=${token}`
        )
        const data = await res.json()

        if (res.ok) {
          setState({ status: 'success', message: data.message || 'Email verified successfully. You can now log in.' })
        } else {
          const detail = typeof data.detail === 'string'
            ? data.detail
            : 'Verification failed. The link may have expired.'
          setState({ status: 'error', message: detail })
        }
      } catch {
        setState({ status: 'error', message: 'Something went wrong. Please try again.' })
      }
    }

    verify()
  }, [token])

  const { status, message } = state

  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-10 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
          <ShieldCheck size={24} className="text-white" />
        </div>
      </div>

      {status === 'loading' && (
        <>
          <Loader2 size={32} className="mx-auto text-blue-600 animate-spin mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Verifying your email...</h1>
          <p className="text-slate-500 text-sm">Please wait a moment.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 size={40} className="mx-auto text-green-500 mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Email Verified!</h1>
          <p className="text-slate-500 text-sm mb-6">{message}</p>
          <Link
            href="/login"
            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            Sign in to Portal
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={40} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Verification Failed</h1>
          <p className="text-slate-500 text-sm mb-6">{message}</p>
          <Link
            href="/signup"
            className="inline-block w-full bg-slate-900 hover:bg-slate-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            Back to Sign Up
          </Link>
        </>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Loader2 size={32} className="mx-auto text-blue-600 animate-spin mb-4" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}
