"use client"
import React, { useState, useEffect } from 'react'
import { apiFetch } from '@/src/lib/api'
import { X, Calendar, Clock, AlertCircle } from 'lucide-react'
import { DateTimePicker } from '@/components/ui/datetime-picker'

interface Subject {
  uid: string
  name: string
}

interface CreateExamModalProps {
  isOpen: boolean
  institutionUid: string
  subjects: Subject[]
  onClose: () => void
  onSuccess: () => void
}

export default function CreateExamModal({ isOpen, onClose, institutionUid, subjects, onSuccess }: CreateExamModalProps) {
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectUid, setSubjectUid] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [startTime, setStartTime] = useState<Date | undefined>(undefined)
  const [endTime, setEndTime] = useState<Date | undefined>(undefined)
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [shuffleOptions, setShuffleOptions] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Hydrate fields when modal opens
  useEffect(() => {
    if (!isOpen) return

    if (subjects.length > 0) setSubjectUid(subjects[0].uid)
    
    // Set a default start time (now) and end time (+24h)
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    setStartTime(now)
    setEndTime(tomorrow)
    
    // Reset standard state
    setTitle('')
    setDescription('')
    setDurationMinutes(60)
    setShuffleQuestions(false)
    setShuffleOptions(false)
    setError(null)
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!startTime || !endTime) {
      setError("Please select both start and end times")
      setLoading(false)
      return
    }

    // Convert local datetime to UTC for the backend
    const startUTC = startTime.toISOString()
    const endUTC = endTime.toISOString()

    try {
      const res = await apiFetch("/exam/create_exam", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          institution_uid: institutionUid,
          subject_uid: subjectUid,
          duration_minutes: durationMinutes,
          start_time: startUTC,
          end_time: endUTC,
          shuffle_questions: shuffleQuestions,
          shuffle_options: shuffleOptions
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to create exam")
      }

      onSuccess()
      onClose()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unknown error occurred")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-bold text-slate-900 mb-2">Create New Exam</h2>
        <p className="text-sm text-slate-500 mb-6">Configure the rules, timing, and security for this examination.</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Exam Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midterm Assessment"
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Instructions or exam details..."
                rows={2}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Subject</label>
              <div className="relative">
                <select 
                  value={subjectUid}
                  onChange={(e) => setSubjectUid(e.target.value)}
                  required
                  disabled={subjects.length === 0}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none bg-white font-medium"
                >
                  {subjects.length === 0 ? (
                    <option value="">No subjects available</option>
                  ) : (
                    subjects.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)
                  )}
                </select>
                {/* Custom dropdown arrow */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Minutes)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Clock size={16} />
                </div>
                <input 
                  type="number" 
                  min={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valid From</label>
              <DateTimePicker date={startTime} setDate={setStartTime} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until</label>
              <DateTimePicker date={endTime} setDate={setEndTime} />
            </div>

            <div className="col-span-1 md:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Shuffle Questions</h4>
                  <p className="text-[11px] text-slate-500">Each student will see questions in a randomized order.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Shuffle Options</h4>
                    <p className="text-[11px] text-slate-500">Randomize choices (A, B, C, D) within each question.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {shuffleOptions && (
                  <div className="mt-3 p-3 bg-white border border-amber-50 rounded-lg flex gap-3 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="text-amber-600 shrink-0" size={16} />
                    <div className="text-[11px] text-amber-800 leading-relaxed">
                      <p className="font-bold mb-1">Notice: Option shuffling may affect questions with:</p>
                      <ul className="list-disc ml-4 space-y-0.5">
                        <li>All of the above</li>
                        <li>None of the above</li>
                        <li>Both A and B</li>
                      </ul>
                      <p className="mt-1 italic opacity-80">Use position-independent wording instead.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading || !title.trim() || !subjectUid}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Create Exam"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
