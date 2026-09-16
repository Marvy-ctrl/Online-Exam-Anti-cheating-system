import { Plus, Trash2, X } from 'lucide-react'

interface QuestionEditorProps {
  editing: boolean
  loading: boolean
  questionText: string
  marks: string
  options: string[]
  correctOptionIndex: number
  onQuestionTextChange: (value: string) => void
  onMarksChange: (value: string) => void
  onOptionsChange: (value: string[]) => void
  onCorrectOptionChange: (index: number) => void
  onSubmit: () => void
  onCancel: () => void
}

export function QuestionEditor({
  editing, loading, questionText, marks, options, correctOptionIndex,
  onQuestionTextChange, onMarksChange, onOptionsChange, onCorrectOptionChange,
  onSubmit, onCancel,
}: QuestionEditorProps) {
  const addOption = () => onOptionsChange([...options, ''])
  const removeOption = (index: number) => {
    if (options.length <= 2) return
    onOptionsChange(options.filter((_, optionIndex) => optionIndex !== index))
    if (correctOptionIndex === index) onCorrectOptionChange(0)
    else if (correctOptionIndex > index) onCorrectOptionChange(correctOptionIndex - 1)
  }
  const updateOption = (index: number, value: string) => {
    const updated = [...options]
    updated[index] = value
    onOptionsChange(updated)
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-6 animate-in slide-in-from-top-2 duration-300">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{editing ? 'Edit Question' : 'Create New Question'}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600" aria-label="Close question editor"><X size={20} /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Question Text</label>
          <textarea value={questionText} onChange={(event) => onQuestionTextChange(event.target.value)} placeholder="Enter the question text here..." className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div className="w-1/3">
          <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Marks / Score</label>
          <input type="number" step="0.5" min="0" value={marks} onChange={(event) => onMarksChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500" />
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Options</label>
          <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 p-2 text-[10px] italic text-slate-500">Tip: Type your options below and click the green radio button to mark the correct answer.</p>
          <div className="space-y-3">
            {options.map((option, index) => (
              <div key={index} className={`flex items-center gap-3 rounded-xl border p-2 transition-all ${correctOptionIndex === index ? 'border-green-200 bg-green-50 ring-1 ring-green-100' : 'border-transparent bg-slate-50'}`}>
                <div className="flex flex-col items-center px-1">
                  <input type="radio" name="correct" checked={correctOptionIndex === index} onChange={() => onCorrectOptionChange(index)} className="h-5 w-5 cursor-pointer border-slate-300 text-green-600 focus:ring-green-500" />
                  <span className="mt-0.5 text-[9px] font-bold uppercase text-green-600">Correct</span>
                </div>
                <input type="text" value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Option ${index + 1}`} className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500" />
                <button onClick={() => removeOption(index)} disabled={options.length <= 2} className="px-1 text-slate-300 transition-colors hover:text-red-500 disabled:opacity-0" aria-label={`Remove option ${index + 1}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button onClick={addOption} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"><Plus size={14} /> Add another option</button>
        </div>
        <div className="flex gap-3 border-t border-slate-100 pt-4">
          <button onClick={onSubmit} disabled={loading} className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50">{loading ? (editing ? 'Updating...' : 'Adding...') : editing ? 'Update Question' : 'Save Question'}</button>
          <button onClick={onCancel} className="flex-1 rounded-xl bg-slate-50 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-100">Cancel</button>
        </div>
      </div>
    </div>
  )
}
