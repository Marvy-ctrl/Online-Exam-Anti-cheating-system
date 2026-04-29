"use client"
import React from 'react'
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from 'next/link'
import { User, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'
const signupSchema = z.object({
  first_name: z.string().min(2, { message: "First name is required" }),
  last_name: z.string().min(2, { message: "Last name is required" }),
  email: z.email({ message: "Please enter a valid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
})

type FormData = z.infer<typeof signupSchema>

export default function SignupForm() {
  const [serverError, setServerError] = React.useState("")
  const [successMsg, setSuccessMsg] = React.useState("")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(signupSchema) })

  const onSubmit = handleSubmit(async (data) => {
    setServerError("")
    setSuccessMsg("")
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      const response = await res.json()

      if (res.status === 409) {
        // Account already exists and is verified
        const detail = typeof response.detail === 'string'
          ? response.detail
          : 'An account with this email already exists.'
        throw new Error(detail)
      }

      if (!res.ok) {
        const detail = typeof response.detail === 'string'
          ? response.detail
          : 'Failed to create account. Please try again.'
        throw new Error(detail)
      }

     
      setSuccessMsg(response.message || "Account created! Please check your email to verify.")
      reset()
    } catch (err) {
      if (err instanceof Error) {
        setServerError(err.message)
      } else {
        setServerError('Failed to create account. Please try again.')
      }
    }
  })

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8">
      
      <div className="w-full max-w-[1000px] border border-slate-200 rounded-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">

        <div 
          className="hidden md:block w-full md:w-5/12 border-r border-slate-200 bg-cover bg-center opacity-80"
          style={{ backgroundImage: 'url(/exam.jpg)' }}
        />

        <div className="w-full md:w-7/12 p-8 lg:p-12 flex flex-col justify-center bg-white relative">
          
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Apply for Examiner Access</h2>
            <p className="text-slate-500 text-sm">Create your account to start managing exams.</p>
          </div>

          {serverError && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600 flex items-center gap-2 font-medium">
                <AlertCircle size={16} /> {serverError}
              </p>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-700 flex items-start gap-2 font-medium">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> 
                {successMsg}
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            
            <div className="flex flex-col sm:flex-row gap-4">
              {/* First Name */}
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700  tracking-wider mb-2">
                  First Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={16} className={errors.first_name ? "text-red-400" : "text-slate-400"} />
                  </div>
                  <input
                    type="text"
                    placeholder="Marvel"
                    {...register("first_name")}
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-lg text-sm transition-colors outline-none
                      ${errors.first_name 
                        ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/30" 
                        : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 hover:bg-slate-100"
                      }`}
                  />
                </div>
                {errors.first_name && (
                  <p className="mt-1.5 text-xs font-semibold text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.first_name.message}
                  </p>
                )}
              </div>

              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700  tracking-wider mb-2">
                  Last Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={16} className={errors.last_name ? "text-red-400" : "text-slate-400"} />
                  </div>
                  <input
                    type="text"
                    placeholder="Sam"
                    {...register("last_name")}
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-lg text-sm transition-colors outline-none
                      ${errors.last_name 
                        ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/30" 
                        : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 hover:bg-slate-100"
                      }`}
                  />
                </div>
                {errors.last_name && (
                  <p className="mt-1.5 text-xs font-semibold text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.last_name.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700  tracking-wider mb-2">
                Enter your email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={16} className={errors.email ? "text-red-400" : "text-slate-400"} />
                </div>
                <input
                  type="email"
                  placeholder="examiner@gmail.com"
                  {...register("email")}
                  className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-lg text-sm transition-colors outline-none
                    ${errors.email 
                      ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/30" 
                      : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 hover:bg-slate-100"
                    }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs font-semibold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700  tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={16} className={errors.password ? "text-red-400" : "text-slate-400"} />
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register("password")}
                  className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-lg text-sm transition-colors outline-none
                    ${errors.password 
                      ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/30" 
                      : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 hover:bg-slate-100"
                    }`}
                />
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs font-semibold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.password.message}
                </p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg text-sm transition-colors mt-2"
            >
              {isSubmitting ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                Sign in
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

