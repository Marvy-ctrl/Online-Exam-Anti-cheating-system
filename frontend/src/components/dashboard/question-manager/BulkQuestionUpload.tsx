import { X } from 'lucide-react'

interface BulkQuestionUploadProps {
  value: string
  loading: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function BulkQuestionUpload({ value, loading, onChange, onSubmit, onCancel }: BulkQuestionUploadProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-in slide-in-from-top-2 duration-300">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="font-bold text-slate-900">Bulk Upload (JSON)</h3><p className="mt-1 text-xs text-slate-500">Paste an array of questions following the required format.</p></div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600" aria-label="Close bulk upload"><X size={20} /></button>
      </div>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={`[\n  {\n    "question_text": "What is 2+2?",\n    "marks": 5.0,\n    "options": ["3", "4", "5"],\n    "correct_answer": "4",\n    "order_index": 1\n  }\n]`} className="mb-4 min-h-[250px] w-full rounded-xl bg-slate-900 p-4 font-mono text-xs text-blue-400 outline-none transition-all focus:ring-2 focus:ring-blue-500/20" />
      <div className="flex gap-3">
        <button onClick={onSubmit} disabled={loading || !value.trim()} className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50">{loading ? 'Uploading...' : 'Upload Questions'}</button>
        <button onClick={onCancel} className="flex-1 rounded-xl bg-slate-50 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-100">Cancel</button>
      </div>
    </div>
  )
}
