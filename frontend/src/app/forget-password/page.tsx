"use client"
import React, { useState } from 'react'
import Link from 'next/link'
import { Mail, AlertCircle, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'

export default function ForgetPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    
    setStatus('loading')
    setMessage('')

    try {
      const res = await apiFetch('/auth/forget-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage(data.data?.message || 'A password reset link has been sent to your email.')
      } else {
        setStatus('error')
        setMessage(data.detail || data.error || 'Failed to send reset link.')
      }
    } catch (err) {
      setStatus('error')
      setMessage('An unexpected error occurred. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Forgot Password</h2>
          <p className="text-slate-500 text-sm">Enter your email address and we will send you a link to reset your password.</p>
        </div>

        {status === 'success' ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <p className="text-slate-700 font-medium mb-6">{message}</p>
            <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700">
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {status === 'error' && (
              <div className="p-4 rounded-lg bg-red-50 text-red-600 flex items-start gap-3 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{message}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="examiner@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                'Send Reset Link'
              )}
            </button>
            
            <div className="text-center mt-6">
              <Link href="/login" className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
