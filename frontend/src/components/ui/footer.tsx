import React from 'react'
import Link from 'next/link'
import { Shield } from 'lucide-react'

const links = {
  Product: ['Features', 'How it works'],
  Examiners: ['Sign up', 'Sign in', 'Dashboard'],
}

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 w-full">
      <div className="max-w-6xl mx-auto px-6 py-16">

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 mb-12">

          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Shield size={15} className="text-white" />
              </div>
              <span className="text-slate-900 font-semibold text-lg tracking-tight">
                Exam<span className="text-blue-600">Guard</span>
              </span>
            </Link>
            <p className="text-slate-500 text-sm leading-snug">
              An examination platform built for integrity.
              Biometric verification, live AI monitoring, examiner control.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-16 flex-1">
            {Object.entries(links).map(([group, items]) => (
              <div key={group}>
                <p className="text-slate-900 font-semibold text-sm mb-4">{group}</p>
                <ul className="space-y-2.5">
                  {items.map((item) => (
                    <li key={item}>
                      <Link
                        href={`#${item.toLowerCase().replace(' ', '-')}`}
                        className="text-slate-500 hover:text-slate-900 text-sm transition-colors duration-200"
                      >
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-slate-400 text-xs">
            © {new Date().getFullYear()} ExamGuard. Built for integrity.
          </p>
          <p className="text-slate-400 text-xs">
            Zero Trust · Biometric · Real-time Monitored
          </p>
        </div>

      </div>
    </footer>
  )
}
