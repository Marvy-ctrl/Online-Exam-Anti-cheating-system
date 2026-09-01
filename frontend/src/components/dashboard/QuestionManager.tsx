"use client"
import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Save, X, AlertCircle, CheckCircle, FileUp, List, HelpCircle } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'

interface Option {
  uid: string
  option_text: string
  is_correct: boolean
}

interface Question {
  uid: string
  question_text: string
  marks: number
  order_index: number
  options: Option[]
}

interface QuestionManagerProps {
  examUid: string
}

export default function QuestionManager({ examUid }: QuestionManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Create / Edit State
  const [isAdding, setIsAdding] = useState(false)
  const [isBulkAdding, setIsBulkAdding] = useState(false)
  const [newQuestionText, setNewQuestionText] = useState('')
  const [newMarks, setNewMarks] = useState('1.0')
  const [newOptions, setNewOptions] = useState<string[]>(['', ''])
  const [correctOptionIdx, setCorrectOptionIdx] = useState(0)
  const [bulkData, setBulkData] = useState('')
  
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [selectedUids, setSelectedUids] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/questions/${examUid}`)
      if (res.ok) {
        const data = await res.json()
        setQuestions(data.questions || [])
      } else {
        setError("Failed to load questions.")
      }
    } catch (err) {
      setError("An error occurred while fetching questions.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuestions()
  }, [examUid])

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim()) return alert("Question text is required")
    if (newOptions.some(o => !o.trim())) return alert("All options must have text")
    
    setLoading(true)
    try {
      const res = await apiFetch(`/questions/${examUid}/upload`, {
        method: 'POST',
        body: JSON.stringify([{
          question_text: newQuestionText,
          marks: parseFloat(newMarks) || 1.0,
          options: newOptions,
          correct_answer: newOptions[correctOptionIdx],
          order_index: questions.length + 1
        }])
      })

      if (res.ok) {
        setSuccess("Question added successfully!")
        resetForm()
        fetchQuestions()
      } else {
        const data = await res.json()
        setError(data.detail || "Failed to add question")
      }
    } catch (err) {
      setError("An error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const handleBulkUpload = async () => {
    try {
      const data = JSON.parse(bulkData)
      if (!Array.isArray(data)) throw new Error("Data must be an array of questions")
      
      setLoading(true)
      const res = await apiFetch(`/questions/${examUid}/upload`, {
        method: 'POST',
        body: JSON.stringify(data)
      })

      if (res.ok) {
        setSuccess("Questions uploaded successfully!")
        setIsBulkAdding(false)
        setBulkData('')
        fetchQuestions()
      } else {
        const errData = await res.json()
        setError(errData.detail || "Failed to upload questions")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Invalid JSON format: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteQuestion = async (uid: string) => {
    if (!window.confirm("Delete this question?")) return
    try {
      const res = await apiFetch(`/questions/${uid}`, { method: 'DELETE' })
      if (res.ok) {
        setQuestions(prev => prev.filter(q => q.uid !== uid))
        setSelectedUids(prev => prev.filter(id => id !== uid))
        setSuccess("Question deleted.")
      }
    } catch (err) {
      setError("Failed to delete question.")
    }
  }

  const handleBulkDelete = async () => {
    if (selectedUids.length === 0) return
    if (!window.confirm(`Delete ${selectedUids.length} selected questions?`)) return
    
    setLoading(true)
    try {
      const res = await apiFetch(`/questions/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ question_uids: selectedUids })
      })

      if (res.ok) {
        setSuccess(`Successfully deleted ${selectedUids.length} questions.`)
        setQuestions(prev => prev.filter(q => !selectedUids.includes(q.uid)))
        setSelectedUids([])
      } else {
        setError("Failed to delete questions.")
      }
    } catch (err) {
      setError("An error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (q: Question) => {
    setEditingUid(q.uid)
    setNewQuestionText(q.question_text)
    setNewMarks((q.marks ?? 1.0).toString())
    setNewOptions((q.options || []).map(o => o.option_text))
    
    const correctIdx = (q.options || []).findIndex(o => o.is_correct)
    setCorrectOptionIdx(correctIdx !== -1 ? correctIdx : 0)
    
    setIsEditing(true)
    setIsAdding(false)
    setIsBulkAdding(false)
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleUpdateQuestion = async () => {
    if (!editingUid) return
    if (!newQuestionText.trim()) return alert("Question text is required")
    
    setLoading(true)
    try {
      const res = await apiFetch(`/questions/${editingUid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          question_text: newQuestionText,
          marks: parseFloat(newMarks) || 1.0,
          options: newOptions,
          correct_answer: newOptions[correctOptionIdx]
        })
      })

      if (res.ok) {
        setSuccess("Question updated successfully!")
        resetForm()
        fetchQuestions()
      } else {
        const data = await res.json()
        setError(data.detail || "Failed to update question")
      }
    } catch (err) {
      setError("An error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (uid: string) => {
    setSelectedUids(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    )
  }

  const toggleSelectAll = () => {
    if (selectedUids.length === questions.length) {
      setSelectedUids([])
    } else {
      setSelectedUids(questions.map(q => q.uid))
    }
  }

  const resetForm = () => {
    setNewQuestionText('')
    setNewMarks('1.0')
    setNewOptions(['', ''])
    setCorrectOptionIdx(0)
    setIsAdding(false)
    setIsEditing(false)
    setEditingUid(null)
  }

  const addOptionField = () => setNewOptions(prev => [...prev, ''])
  const removeOptionField = (idx: number) => {
    if (newOptions.length <= 2) return
    setNewOptions(prev => prev.filter((_, i) => i !== idx))
    if (correctOptionIdx === idx) setCorrectOptionIdx(0)
    else if (correctOptionIdx > idx) setCorrectOptionIdx(prev => prev - 1)
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-base md:text-xl font-bold text-slate-900 flex items-center gap-2">
          {/* <HelpCircle className="text-blue-600" /> */}
          Exam Questions ({questions.length})
        </h2>
        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
          <button 
            onClick={() => { setIsAdding(true); setIsBulkAdding(false); setIsEditing(false); }}
            className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 md:order-3 md:col-span-1 md:py-2"
          >
            <Plus size={16} /> Add Question
          </button>
            {selectedUids.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 md:order-2 md:border-0 md:bg-transparent md:px-4 md:py-2"
            >
              <Trash2 size={16} /> Delete ({selectedUids.length})
            </button>
          )}
          <button 
            onClick={() => { setIsBulkAdding(true); setIsAdding(false); setIsEditing(false); }}
            className={`inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 md:order-1 md:px-4 md:py-2 ${selectedUids.length === 0 ? 'col-span-2' : ''}`}
          >
            <FileUp size={16} /> Bulk JSON
          </button>
        
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
          <AlertCircle size={18} /> {error}
          <button onClick={() => setError('')} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-green-600 text-sm flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
          <CheckCircle size={18} /> {success}
          <button onClick={() => setSuccess('')} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* Add / Edit Form */}
      {(isAdding || isEditing) && (
        <div className="bg-white border border-blue-100 rounded-2xl p-6 animate-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900">
              {isEditing ? 'Edit Question' : 'Create New Question'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Question Text</label>
              <textarea 
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Enter the question text here..."
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[100px]"
              />
            </div>

            <div className="w-1/3">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Marks / Score</label>
              <input 
                type="number"
                step="0.5"
                min="0"
                value={newMarks}
                onChange={(e) => setNewMarks(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Options</label>
              <p className="text-[10px] text-slate-500 mb-3 bg-blue-50 border border-blue-100 p-2 rounded-lg italic">
                Tip: Type your options below and click the green radio button to mark which one is the correct answer.
              </p>
              <div className="space-y-3">
                {newOptions.map((opt, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center gap-3 p-2 rounded-xl transition-all border ${
                      correctOptionIdx === idx 
                        ? 'bg-green-50 border-green-200 ring-1 ring-green-100' 
                        : 'bg-slate-50 border-transparent'
                    }`}
                  >
                    <div className="flex flex-col items-center px-1">
                      <input 
                        type="radio" 
                        name="correct" 
                        checked={correctOptionIdx === idx}
                        onChange={() => setCorrectOptionIdx(idx)}
                        className="w-5 h-5 text-green-600 border-slate-300 focus:ring-green-500 cursor-pointer"
                      />
                      <span className="text-[9px] font-bold text-green-600 uppercase mt-0.5">Correct</span>
                    </div>
                    <input 
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const updated = [...newOptions]
                        updated[idx] = e.target.value
                        setNewOptions(updated)
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 bg-white border border-slate-200 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 outline-none transition-all "
                    />
                    <button 
                      onClick={() => removeOptionField(idx)}
                      disabled={newOptions.length <= 2}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors px-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={addOptionField}
                className="mt-3 text-sm font-semibold text-blue-600 flex items-center gap-1.5 hover:underline"
              >
                <Plus size={14} /> Add another option
              </button>
            </div>

            <div className="pt-4 flex gap-3 border-t border-slate-100">
              <button 
                onClick={isEditing ? handleUpdateQuestion : handleAddQuestion}
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {loading ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update Question" : "Save Question")}
              </button>
              <button 
                onClick={resetForm}
                className="flex-1 py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk JSON Form */}
      {isBulkAdding && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 animate-in slide-in-from-top-2 duration-300">
           <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-900">Bulk Upload (JSON)</h3>
              <p className="text-xs text-slate-500 mt-1">Paste an array of questions following the required format.</p>
            </div>
            <button onClick={() => setIsBulkAdding(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
          </div>
          
          <textarea 
            value={bulkData}
            onChange={(e) => setBulkData(e.target.value)}
            placeholder={`[\n  {\n    "question_text": "What is 2+2?",\n    "marks": 5.0,\n    "options": ["3", "4", "5"],\n    "correct_answer": "4",\n    "order_index": 1\n  }\n]`}
            className="w-full bg-slate-900 text-blue-400 font-mono p-4 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[250px] mb-4"
          />

          <div className="flex gap-3">
            <button 
              onClick={handleBulkUpload}
              disabled={loading || !bulkData.trim()}
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? "Uploading..." : "Upload Questions"}
            </button>
            <button 
              onClick={() => setIsBulkAdding(false)}
              className="flex-1 py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {questions.length === 0 && !loading && !isAdding && !isBulkAdding && (
          <div className="py-20 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center">
            
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Questions Yet</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Start by adding a single question manually or bulk upload using JSON format.
            </p>
          </div>
        )}

        {questions.length > 0 && (
          <div className="flex items-center gap-3 px-2 py-1">
            <input 
              type="checkbox"
              checked={selectedUids.length === questions.length && questions.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {selectedUids.length > 0 ? `${selectedUids.length} selected` : 'Select All'}
            </span>
          </div>
        )}

        {questions.map((q, index) => (
          <div 
            key={q.uid} 
            className={`bg-white border rounded-2xl p-6 hover:border-blue-200 transition-all group relative ${
              selectedUids.includes(q.uid) ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center gap-2 mt-1">
                  <input 
                    type="checkbox"
                    checked={selectedUids.includes(q.uid)}
                    onChange={() => toggleSelect(q.uid)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                    {q.order_index}
                  </span>
                </div>
                <div>
                  <p className="text-slate-900 font-medium leading-relaxed">{q.question_text}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 mt-2 uppercase tracking-wider">
                    {q.marks ?? 1.0} {(q.marks ?? 1.0) === 1 ? 'Mark' : 'Marks'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEditClick(q)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Question"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDeleteQuestion(q.uid)}
                  className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                  title="Delete Question"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-12">
              {q.options?.map((opt) => (
                <div 
                  key={opt.uid} 
                  className={`px-4 py-2.5 rounded-xl text-sm border flex items-center justify-between ${
                    opt.is_correct 
                      ? 'bg-green-50 border-green-100 text-green-700 font-semibold' 
                      : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}
                >
                  <span className="truncate">{opt.option_text}</span>
                  {opt.is_correct && <CheckCircle size={14} className="shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
