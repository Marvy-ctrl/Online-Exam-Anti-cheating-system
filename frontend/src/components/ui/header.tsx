"use client"
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import Image from 'next/image'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/90 backdrop-blur-md border-b border-slate-200'
        : 'bg-white border-b border-slate-100'
    }`}>
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">

          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <Image 
              src="/examloc_logo.png" 
              alt="ExamLoc Logo" 
              width={120} 
              height={32} 
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex gap-7 text-sm font-medium text-slate-500">
              <Link href="/#features" className="hover:text-slate-900 transition-colors duration-200">Features</Link>
              <Link href="/#how-it-works" className="hover:text-slate-900 transition-colors duration-200">How it works</Link>
              <Link href="/guide" className="hover:text-slate-900 transition-colors duration-200">How to Use</Link>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg transition-colors duration-200"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Get started
              </Link>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-slate-500 hover:text-slate-900 p-2 focus:outline-none transition-colors"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-1 border-t border-slate-100 pt-4">
            {[
              { label: 'Features', href: '/#features' },
              { label: 'How it works', href: '/#how-it-works' },
              { label: 'How to Use', href: '/guide' }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="block px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-3">
              <Link href="/login" className="block text-center text-sm text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                Sign in
              </Link>
              <Link href="/signup" className="block text-center text-sm bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-500 transition-colors">
                Get started
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}