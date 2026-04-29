import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const features = [
  {
    number: '01',
    title: 'Verified Student Identity',
    desc: 'Ensure the right student is taking the exam using secure face verification.',
  },
  {
    number: '02',
    title: 'Real-Time Cheating Detection',
    desc: 'Automatically detect suspicious behavior like looking away, multiple faces, or unusual movements during exams.',
  },
  {
    number: '03',
    title: 'Custom Anti-Cheat Rules',
    desc: 'Define what counts as cheating and automate actions like warnings, flags, or auto-submission.',
  },
  {
    number: '04',
    title: 'Strict Exam Timing Control',
    desc: 'Control when exams start and end, prevent late access, and enforce submission deadlines automatically.',
  },
]

export default function Features() {
  return (
    <section id="features" className="bg-slate-950 w-full">
      <div className="max-w-6xl mx-auto px-6 py-24">

        {/* Heading */}
        <div className="max-w-2xl mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white leading-none mb-4">
            Core Anti-Cheating Features
          </h2>
          <p className="text-slate-400 text-base leading-snug">
            A system designed to detect, prevent, and respond to real exam violations in real time.
          </p>
        </div>

        {/* 2×2 card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {features.map(({ number, title, desc }) => (
            <div
              key={number}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-7 hover:bg-white/[0.05] hover:border-white/14 transition-colors duration-200"
            >
              <span className="text-blue-500 text-xs font-bold tracking-widest uppercase mb-4 block">
                {number}
              </span>
              <h3 className="text-white font-semibold text-lg mb-3">{title}</h3>
              <p className="text-slate-400 text-sm leading-snug">{desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-white/8 pt-10">
        
          <Link
            href="/signup"
            id="features-cta"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors duration-200 whitespace-nowrap group"
          >
            Get started free
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform duration-200" />
          </Link>
        </div>

      </div>
    </section>
  )
}
