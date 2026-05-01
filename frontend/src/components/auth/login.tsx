"use client"
import React from 'react'
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from 'next/link'
// import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {  Mail, Lock, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'
const loginSchema = z.object({
  email: z.email({ message: "Please enter a valid institution email" }),
  password: z.string().min(1, { message: "Password is required" }),
})

type FormData = z.infer<typeof loginSchema>

export default function Loginform() {
  const router = useRouter()
  const [serverError, setServerError] = React.useState("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async (data) => {
    setServerError("")
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      
      const response = await res.json()
      
      if (!res.ok) {
        throw new Error(response.detail || "Invalid email or password")
      }
      
      // The token is now set automatically via HttpOnly cookie
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof Error) {
        setServerError(err.message)
      } else {
        setServerError('Invalid email or password')
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

        <div className="w-full md:w-7/12 p-10 lg:p-14 flex flex-col justify-center bg-white relative">
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Sign in to your account</h2>
            <p className="text-slate-500 text-sm">Enter your examiner credentials to access the portal.</p>
          </div>

          {serverError && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600 flex items-center gap-2 font-medium">
                <AlertCircle size={16} /> {serverError}
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700  tracking-wider mb-2">
                  Enter your email address</label>
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700  tracking-wider">
                  Password
                </label>
                <Link href="/forget-password" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                  Reset password
                </Link>
              </div>
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
              {isSubmitting ? "Signing in..." : "Sign in to Portal"}
            </button>
          </form>

          <div className="mt-10 border-t border-slate-100 pt-6">
            <p className="text-center text-sm text-slate-500">
              No examiner account yet?{' '}
              <Link href="/signup" className="font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                Apply for access
              </Link>
            </p>
          </div>

        </div>
      </div>
    
    </div>
  )
}