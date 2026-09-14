'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, Cog } from 'lucide-react'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { apiFetch } from '@/src/lib/api'
import type { AdminExam } from '@/src/types/admin-exam'

interface ExamSettingsPanelProps {
  exam: AdminExam
  onRefresh: () => Promise<void>
}

export function ExamSettingsPanel({ exam, onRefresh }: ExamSettingsPanelProps) {
  const [title, setTitle] = useState(exam.title)
  const [duration, setDuration] = useState(String(exam.duration_minutes))
  const [description, setDescription] = useState(exam.description || '')
  const [startTime, setStartTime] = useState<Date | undefined>(() => new Date(exam.start_time))
  const [endTime, setEndTime] = useState<Date | undefined>(() => new Date(exam.end_time))
  const [shuffleQuestions, setShuffleQuestions] = useState(exam.shuffle_questions)
  const [shuffleOptions, setShuffleOptions] = useState(exam.shuffle_options)
  const [isUpdating, setIsUpdating] = useState(false)

  async function updateExam(event: FormEvent) {
    event.preventDefault()
    setIsUpdating(true)
    try {
      const response = await apiFetch(`/exam/${exam.uid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          duration_minutes: Number.parseInt(duration, 10),
          description,
          start_time: startTime?.toISOString() || null,
          end_time: endTime?.toISOString() || null,
          shuffle_questions: shuffleQuestions,
          shuffle_options: shuffleOptions,
        }),
      })
      if (!response.ok) {
        const result = await response.json()
        window.alert(`Error: ${result.detail || 'Failed to update exam'}`)
        return
      }
      window.alert('Exam updated successfully!')
      await onRefresh()
    } catch {
      window.alert('Error updating exam.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><Cog size={20} className="text-blue-600" /> Exam Configuration</h2>
      <form onSubmit={updateExam} className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exam Title</label>
          <input type="text" required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none min-h-[100px] resize-y" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Duration (Mins)</label>
            <input type="number" required min="1" value={duration} onChange={(event) => setDuration(event.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start Time</label><DateTimePicker date={startTime} setDate={setStartTime} /></div>
          <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">End Time</label><DateTimePicker date={endTime} setDate={setEndTime} /></div>
        </div>

        <div className="space-y-4 pt-2">
          <SettingToggle title="Shuffle Questions" description="Each student will receive questions in a different order." checked={shuffleQuestions} onChange={setShuffleQuestions} />
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-blue-200">
            <SettingToggle title="Shuffle Options" description="Randomize the order of choices within each question." checked={shuffleOptions} onChange={setShuffleOptions} embedded />
            {shuffleOptions && (
              <div className="mt-4 p-3 bg-white border border-amber-200 rounded-xl flex gap-3">
                <AlertCircle className="text-amber-600 shrink-0" size={18} />
                <div className="text-xs text-amber-800 leading-relaxed"><p className="font-bold mb-1">Notice: Potential Question Ambiguity</p><p>Option shuffling can affect choices such as “All of the above”, “None of the above”, and “Both A and B”.</p><p className="mt-2 italic">Consider using position-independent wording instead.</p></div>
              </div>
            )}
          </div>
        </div>

        <button type="submit" disabled={isUpdating} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">{isUpdating ? 'Saving Changes...' : 'Save Configuration'}</button>
      </form>
    </div>
  )
}

interface SettingToggleProps {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  embedded?: boolean
}

function SettingToggle({ title, description, checked, onChange, embedded = false }: SettingToggleProps) {
  const content = (
    <div className="flex items-center justify-between">
      <div><h4 className="text-sm font-bold text-slate-900">{title}</h4><p className="text-xs text-slate-500">{description}</p></div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
      </label>
    </div>
  )
  return embedded ? content : <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-blue-200">{content}</div>
}
