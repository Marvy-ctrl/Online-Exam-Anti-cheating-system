import { CheckCircle, Edit2, Trash2 } from 'lucide-react'
import type { ManagedQuestion } from '@/src/types/question-manager'

interface QuestionListProps {
  questions: ManagedQuestion[]
  selectedUids: string[]
  loading: boolean
  editorOpen: boolean
  bulkUploadOpen: boolean
  onToggleQuestion: (uid: string) => void
  onToggleAll: () => void
  onEdit: (question: ManagedQuestion) => void
  onDelete: (uid: string) => void
}

export function QuestionList({ questions, selectedUids, loading, editorOpen, bulkUploadOpen, onToggleQuestion, onToggleAll, onEdit, onDelete }: QuestionListProps) {
  return (
    <div className="space-y-4">
      {questions.length === 0 && !loading && !editorOpen && !bulkUploadOpen && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center">
          <h3 className="mb-1 text-lg font-bold text-slate-900">No Questions Yet</h3>
          <p className="mx-auto max-w-xs text-sm text-slate-500">Start by adding a single question manually or bulk upload using JSON format.</p>
        </div>
      )}
      {questions.length > 0 && (
        <div className="flex items-center gap-3 px-2 py-1">
          <input type="checkbox" checked={selectedUids.length === questions.length} onChange={onToggleAll} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500" aria-label="Select all questions" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{selectedUids.length > 0 ? `${selectedUids.length} selected` : 'Select All'}</span>
        </div>
      )}
      {questions.map((question) => (
        <div key={question.uid} className={`group relative rounded-2xl border bg-white p-6 transition-all hover:border-blue-200 ${selectedUids.includes(question.uid) ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'}`}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="mt-1 flex flex-col items-center gap-2">
                <input type="checkbox" checked={selectedUids.includes(question.uid)} onChange={() => onToggleQuestion(question.uid)} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500" aria-label={`Select question ${question.order_index}`} />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500">{question.order_index}</span>
              </div>
              <div><p className="font-medium leading-relaxed text-slate-900">{question.question_text}</p><span className="mt-2 inline-flex rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">{question.marks ?? 1} {(question.marks ?? 1) === 1 ? 'Mark' : 'Marks'}</span></div>
            </div>
            <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <button onClick={() => onEdit(question)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Edit Question"><Edit2 size={18} /></button>
              <button onClick={() => onDelete(question.uid)} className="p-2 text-slate-400 transition-colors hover:text-red-600" title="Delete Question"><Trash2 size={18} /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 pl-12 md:grid-cols-2">
            {question.options?.map((option) => (
              <div key={option.uid} className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${option.is_correct ? 'border-green-100 bg-green-50 font-semibold text-green-700' : 'border-slate-100 bg-slate-50 text-slate-600'}`}>
                <span className="truncate">{option.option_text}</span>{option.is_correct && <CheckCircle size={14} className="shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
