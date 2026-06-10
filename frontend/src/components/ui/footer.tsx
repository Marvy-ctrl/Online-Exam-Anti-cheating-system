import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

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
            <Link href="/" className="flex items-center mb-4 group">
              <Image 
                src="/examloc_logo.png" 
                alt="ExamLoc Logo" 
                width={120} 
                height={32} 
                className="h-8 w-auto object-contain"
              />
            </Link>
            <p className="text-slate-500 text-sm leading-snug">
              An examination platform built for integrity.
              Identity verification, live monitoring, and examiner oversight.
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
            © {new Date().getFullYear()} ExamLoc. Built for integrity.
          </p>
          <p className="text-slate-400 text-xs">
            Secure Exams · Violation Tracking · Examiner Oversight
          </p>
        </div>

      </div>
    </footer>
  )
}
