import React from 'react'
import Link from 'next/link'
import { ArrowRight, Fingerprint, Eye, Brain, ShieldCheck } from 'lucide-react'

const features = [
  { icon: Fingerprint, label: 'Biometric Identity' },
  { icon: Eye,         label: 'Live Gaze Tracking' },
  { icon: Brain,       label: 'Edge AI Processing' },
  { icon: ShieldCheck, label: 'Zero Trust Sessions' },
]

export default function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-white">

      {/* Subtle dark grid on white */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-18 flex flex-col items-center text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-600 text-[11px] font-semibold uppercase tracking-widest mb-7">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-600" />
          </span>
          Live Proctoring Active
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-none tracking-tight mb-5 max-w-3xl">
          Exams that{' '}
          <span className="text-blue-600">can't</span>
          {' '}be cheated.
        </h1>

        {/* Subheading */}
        <p className="text-slate-500 text-lg font-medium max-w-xl mb-10 leading-snug">
          A zero-trust examination platform with biometric identity verification,
          live AI monitoring, and real-time examiner oversight.
        </p>

        {/* CTAs — students receive links via email, no Enter Exam here */}
        <div className="flex items-center gap-3 mb-18">
          <Link
            href="/signup"
            id="hero-cta-signup"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors duration-200 group"
          >
            Start as Examiner
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-200" />
          </Link>
          <Link
            href="/login"
            id="hero-cta-login"
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-semibold text-sm transition-colors duration-200"
          >
            Sign in
          </Link>
        </div>

        {/* Feature pill grid */}
        <div className="w-full max-w-3xl border-t border-slate-200 pt-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-colors duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors duration-200">
                  <Icon size={16} className="text-blue-600" />
                </div>
                <p className="text-slate-800 text-xs font-semibold text-center">{label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}