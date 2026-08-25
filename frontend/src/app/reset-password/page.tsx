"use client"
import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setStatus('error')
      setMessage('Missing reset token. Please use the link sent to your email.')
      return
    }

    if (newPassword !== confirmPassword) {
      setStatus('error')
      setMessage('Passwords do not match.')
      return
    }
    
    if (newPassword.length < 6) {
      setStatus('error')
      setMessage('Password must be at least 6 characters long.')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const res = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ 
          token,
          new_password: newPassword,
          confirm_new_password: confirmPassword
        })
      })
      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage(data.data?.message || 'Password reset successfully.')
      } else {
        setStatus('error')
        setMessage(data.detail || data.error || 'Failed to reset password.')
      }
    } catch (err) {
      setStatus('error')
      setMessage('An unexpected error occurred. Please try again.')
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        {/* <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div> */}
        <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h2>
        <p className="text-slate-500 mb-6">No reset token provided in the URL.</p>
        <Link href="/forget-password" className="text-blue-600 font-semibold hover:text-blue-700">
          Request a new link
        </Link>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        {/* <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} />
        </div> */}
        <h2 className="text-xl font-bold text-slate-900 mb-2">Success</h2>
        <p className="text-slate-700 font-medium mb-6">{message}</p>
        <button 
          onClick={() => router.push('/login')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
        >
          Proceed to Login
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Create New Password</h2>
        <p className="text-slate-500 text-sm">Please enter your new password below.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {status === 'error' && (
          <div className="p-4 text-red-600 flex items-start gap-3 text-sm">
            {/* <AlertCircle size={18} className="shrink-0 mt-0.5" /> */}
            <p>{message}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
          <div className="relative">
           
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-3 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
          <div className="relative">
           
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-3 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center"
        >
          {status === 'loading' ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Reset Password'
          )}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full shadow-sm border border-slate-100 p-8">
        <Suspense fallback={<div className="text-center py-10 text-slate-400">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
