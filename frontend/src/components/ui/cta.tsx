import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function CTA() {
  return (
    <section className="bg-slate-950 w-full">
      <div className="max-w-6xl mx-auto px-6 py-24 text-center">

        <p className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-5">
          Ready to get started?
        </p>

        <h2 className="text-4xl sm:text-5xl font-bold text-white leading-none mb-6 max-w-2xl mx-auto">
          Run exams you can actually trust.
        </h2>

        <p className="text-slate-400 text-base max-w-xl mx-auto mb-10 leading-snug">
          Sign up as an examiner, create your first exam in minutes, and let ExamGuard handle
          identity verification and live monitoring from end to end.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            id="cta-signup"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors duration-200 group"
          >
            Create your account
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-200" />
          </Link>
          <Link
            href="/login"
            id="cta-login"
            className="flex items-center gap-2 border border-white/12 hover:border-white/25 text-slate-300 hover:text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors duration-200"
          >
            Already have an account? Sign in
          </Link>
        </div>

      </div>
    </section>
  )
}
