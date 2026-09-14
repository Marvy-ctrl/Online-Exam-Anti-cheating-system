import { X } from 'lucide-react'
import type { AnswerState, ExamQuestion } from '@/src/types/exam'

interface QuestionNavigatorProps {
  answers: AnswerState
  currentIndex: number
  drawerOpen: boolean
  onCloseDrawer: () => void
  onOpenSubmit: () => void
  onSelectQuestion: (index: number) => void
  questions: ExamQuestion[]
}

function NavigatorLegend() {
  return (
    <>
      <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
        <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200" /> Answered
      </div>
      <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
        <div className="w-3 h-3 rounded bg-white border border-slate-200" /> Unanswered
      </div>
    </>
  )
}

function questionButtonClass(isCurrent: boolean, isAnswered: boolean) {
  if (isCurrent) {
    return 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
  }
  if (isAnswered) return 'bg-blue-50 text-blue-600 border-blue-200'
  return 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
}

export function QuestionNavigator({
  answers,
  currentIndex,
  drawerOpen,
  onCloseDrawer,
  onOpenSubmit,
  onSelectQuestion,
  questions,
}: QuestionNavigatorProps) {
  const answeredCount = Object.keys(answers).length

  return (
    <>
      <aside className="hidden md:flex w-64 shrink-0 bg-slate-50 border-r border-slate-200 flex-col overflow-y-auto">
        <div className="p-5 border-b border-slate-200 bg-white">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Question Navigator
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-slate-900">{answeredCount}</div>
            <div className="text-xs text-slate-400">of {questions.length} answered</div>
          </div>
        </div>
        <div className="p-4 grid grid-cols-4 gap-2.5">
          {questions.map((question, index) => (
            <button
              key={question.uid}
              id={`nav-q-${index + 1}`}
              onClick={() => onSelectQuestion(index)}
              className={`w-full aspect-square rounded-xl text-xs font-bold transition-all border ${questionButtonClass(index === currentIndex, Boolean(answers[question.uid]))}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <div className="p-5 mt-auto border-t border-slate-200 bg-white space-y-3">
          <NavigatorLegend />
        </div>
      </aside>

      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
            onClick={onCloseDrawer}
          />
          <div className="md:hidden fixed left-0 top-0 bottom-0 w-72 bg-white z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Question Navigator
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {answeredCount} of {questions.length} answered
                </div>
              </div>
              <button
                onClick={onCloseDrawer}
                aria-label="Close question navigator"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-5 gap-2.5">
              {questions.map((question, index) => (
                <button
                  key={question.uid}
                  id={`mobile-nav-q-${index + 1}`}
                  onClick={() => {
                    onSelectQuestion(index)
                    onCloseDrawer()
                  }}
                  className={`w-full aspect-square rounded-xl text-xs font-bold transition-all border ${questionButtonClass(index === currentIndex, Boolean(answers[question.uid]))}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 space-y-2">
              <NavigatorLegend />
              <button
                onClick={() => {
                  onCloseDrawer()
                  onOpenSubmit()
                }}
                className="w-full mt-2 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2"
              >
                Submit Final Script
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
