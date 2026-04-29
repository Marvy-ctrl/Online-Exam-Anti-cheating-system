import React from 'react'
import Header from './ui/header'
import Hero from './ui/hero'
import Features from './ui/features'
import HowItWorks from './ui/how-it-works'
import CTA from './ui/cta'
import Footer from './ui/footer'

export default function Homepage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header sits above the dark hero */}
      <div className="bg-[#0a0f1e]">
        <Header />
      </div>

      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
