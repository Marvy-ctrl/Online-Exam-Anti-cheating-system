import Image from 'next/image'
import { Clock, Menu } from 'lucide-react'
import { formatExamTime } from '@/src/hooks/exam/useExamTimer'
import type { ExamData } from '@/src/types/exam'

interface ExamHeaderProps {
  exam: ExamData
  isSubmitting: boolean
  onOpenNavigator: () => void
  onOpenSubmit: () => void
  timeLeft: number | null
}

function timerColor(timeLeft: number | null, questionCount: number) {
  if (timeLeft === null) return 'text-slate-400'
  const estimatedTotal = Math.max(questionCount, 1) * 60
  const remainingRatio = timeLeft / estimatedTotal
  if (remainingRatio < 0.1) return 'text-red-400'
  if (remainingRatio < 0.2) return 'text-amber-400'
  return 'text-green-400'
}

export function ExamHeader({
  exam,
  isSubmitting,
  onOpenNavigator,
  onOpenSubmit,
  timeLeft,
}: ExamHeaderProps) {
  return (
    <header className="h-14 md:h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 shadow-sm z-10 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button
          id="mobile-nav-toggle"
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-600 shrink-0"
          onClick={onOpenNavigator}
          aria-label="Open question navigator"
        >
          <Menu size={20} />
        </button>
        <Image
          src="/examloc_logo.png"
          alt="ExamLoc Logo"
          width={100}
          height={28}
          className="object-contain shrink-0"
        />
        <div className="hidden md:block ml-8">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">
              {exam.student_first_name} {exam.student_last_name}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
              {exam.student_id}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
            Exam ID: {exam.exam_uid.split('-')[0]} • {exam.questions.length} Questions
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-6 shrink-0">
        <div
          className={`flex items-center gap-1.5 font-mono text-base md:text-xl font-bold px-3 md:px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl ${timerColor(timeLeft, exam.questions.length)}`}
        >
          <Clock size={16} className="md:w-[18px] md:h-[18px]" />
          {formatExamTime(timeLeft)}
        </div>
        <button
          id="submit-exam-btn"
          onClick={onOpenSubmit}
          disabled={isSubmitting}
          className="px-3 md:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
        >
          Finish
        </button>
      </div>
    </header>
  )
}
