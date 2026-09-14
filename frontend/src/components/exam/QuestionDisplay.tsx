import { AlertTriangle, CheckCircle } from 'lucide-react'
import type { AnswerState, ExamQuestion, SaveStatus } from '@/src/types/exam'

interface QuestionDisplayProps {
  answers: AnswerState
  currentIndex: number
  onOpenSubmit: () => void
  onSelectOption: (questionUid: string, optionUid: string) => void
  onSelectQuestion: (index: number) => void
  question: ExamQuestion
  saveStatus?: SaveStatus
  totalQuestions: number
}

export function QuestionDisplay({
  answers,
  currentIndex,
  onOpenSubmit,
  onSelectOption,
  onSelectQuestion,
  question,
  saveStatus,
  totalQuestions,
}: QuestionDisplayProps) {
  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 md:mb-8">
          <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 md:mb-3">
            Question {currentIndex + 1} of {totalQuestions}
          </div>
          <p className="text-lg md:text-xl text-slate-900 leading-relaxed font-semibold">
            {question.question_text}
          </p>
          {saveStatus === 'error' && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle size={12} /> Failed to save — will retry on next selection
            </div>
          )}
        </div>

        <div className="space-y-3 md:space-y-4">
          {question.options.map((option, optionIndex) => {
            const isSelected = answers[question.uid] === option.uid
            const letter = String.fromCharCode(65 + optionIndex)
            return (
              <button
                key={option.uid}
                id={`opt-${currentIndex + 1}-${letter}`}
                onClick={() => onSelectOption(question.uid, option.uid)}
                className={`w-full text-left p-4 md:p-5 rounded-2xl border-2 transition-all duration-200 flex items-start gap-3 md:gap-4 group ${
                  isSelected
                    ? 'bg-blue-50 border-blue-500 text-blue-900'
                    : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-slate-50 shadow-sm'
                }`}
              >
                <span
                  className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                  }`}
                >
                  {letter}
                </span>
                <span className="text-sm md:text-base font-medium leading-relaxed pt-1">
                  {option.option_text}
                </span>
                {isSelected && (
                  <CheckCircle size={20} className="shrink-0 ml-auto text-blue-500 mt-1" />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-100">
          <button
            onClick={() => onSelectQuestion(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="px-4 md:px-6 py-2.5 md:py-3 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← Back
          </button>
          {currentIndex < totalQuestions - 1 ? (
            <button
              onClick={() => onSelectQuestion(currentIndex + 1)}
              className="px-6 md:px-8 py-2.5 md:py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={onOpenSubmit}
              className="px-6 md:px-8 py-2.5 md:py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-green-600/20 flex items-center gap-2"
            >
              Finish Exam
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
