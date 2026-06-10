import React from 'react'
import Image from 'next/image'

const steps = [
  {
    step: '01',
    title: 'Create your exam and pre-enroll students',
    desc: 'Sign up as an examiner, create your exam with a window and duration, then pre-enroll students using their student ID and email. The system generates a secure, time-bound enrollment link sent directly to each student.',
    bullets: [
      'Set exam window (e.g. 1PM - 2PM)',
      'Set duration independently (e.g. 45 mins)',
      'Pre-enroll students',
    ],
    image: '/examiner.jpg',
    imageAlt: 'Examiner creating an exam on a laptop',
    imageSide: 'right' as const,
    bg: 'bg-white',
    textColor: 'text-slate-900',
    subColor: 'text-slate-500',
    bulletColor: 'text-slate-700',
    stepColor: 'text-blue-600',
    borderColor: 'border-blue-100',
  },
  {
    step: '02',
    title: 'Students verify identity before they start',
    desc: 'Students receive an enrollment link by email. They verify their student ID and email first, then the system captures their face. No exam access without face verification.',
    bullets: [
      'ID + email verified against pre-enrollment',
      'Face captured at enrollment',
      'Same face verified again before exam starts',
    ],
    image: '/student.avif',
    imageAlt: 'Student completing face verification',
    imageSide: 'left' as const,
    bg: 'bg-slate-950',
    textColor: 'text-white',
    subColor: 'text-slate-400',
    bulletColor: 'text-slate-300',
    stepColor: 'text-blue-400',
    borderColor: 'border-white/10',
  },
  {
    step: '03',
    title: 'You monitor. The system enforces.',
    desc: 'During the exam, ExamLoc monitors the student\'s session through webcam verification and browser activity tracking. Examiners can view violations in real time, including face absence, multiple face detection, tab switching, and focus loss.',
    bullets: [
      'Live violation feed per student',
      'Auto-submit rules configured',
      'Auto-grade with examiner override',
    ],
    image: '/monitor.png',
    imageAlt: 'Live exam monitoring dashboard',
    imageSide: 'right' as const,
    bg: 'bg-white',
    textColor: 'text-slate-900',
    subColor: 'text-slate-500',
    bulletColor: 'text-slate-700',
    stepColor: 'text-blue-600',
    borderColor: 'border-blue-100',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full">
      {steps.map(({ step, title, desc, bullets, image, imageAlt, imageSide, bg, textColor, subColor, bulletColor, stepColor, borderColor }) => (
        <div key={step} className={`${bg} w-full`}>
          <div className="max-w-6xl mx-auto px-6 py-24">
            <div className={`flex flex-col ${imageSide === 'left' ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-16`}>

              {/* Text side */}
              <div className="flex-1 max-w-lg">
                <span className={`text-xs font-bold tracking-widest uppercase ${stepColor} mb-4 block`}>
                  Step {step}
                </span>
                <h2 className={`text-3xl sm:text-4xl font-bold ${textColor} leading-none mb-5`}>
                  {title}
                </h2>
                <p className={`${subColor} text-base leading-snug mb-8`}>
                  {desc}
                </p>
                <ul className={`space-y-2.5 border-t ${borderColor} pt-6`}>
                  {bullets.map((b) => (
                    <li key={b} className={`flex items-start gap-2.5 text-sm ${bulletColor}`}>
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full ${stepColor === 'text-blue-600' ? 'bg-blue-600' : 'bg-blue-400'} flex-shrink-0`} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Image side */}
              <div className="flex-1 w-full">
                <div className="rounded-2xl overflow-hidden">
                  <Image
                    src={image}
                    alt={imageAlt}
                    width={640}
                    height={480}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      ))}
    </section>
  )
}
