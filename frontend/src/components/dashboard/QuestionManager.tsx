"use client"

import { useState } from 'react'
import { AlertCircle, CheckCircle, FileUp, Plus, Trash2, X } from 'lucide-react'
import { BulkQuestionUpload } from './question-manager/BulkQuestionUpload'
import { QuestionEditor } from './question-manager/QuestionEditor'
import { QuestionList } from './question-manager/QuestionList'
import { useQuestionManager } from '@/src/hooks/useQuestionManager'
import type { ManagedQuestion } from '@/src/types/question-manager'

interface QuestionManagerProps {
  examUid: string
}

type EditorMode = 'closed' | 'create' | 'edit'

export default function QuestionManager({ examUid }: QuestionManagerProps) {
  const manager = useQuestionManager(examUid)
  const [editorMode, setEditorMode] = useState<EditorMode>('closed')
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [questionText, setQuestionText] = useState('')
  const [marks, setMarks] = useState('1.0')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0)
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)
  const [bulkData, setBulkData] = useState('')

  const resetEditor = () => {
    setQuestionText('')
    setMarks('1.0')
    setOptions(['', ''])
    setCorrectOptionIndex(0)
    setEditingUid(null)
    setEditorMode('closed')
  }

  const openCreateEditor = () => {
    resetEditor()
    setEditorMode('create')
    setBulkUploadOpen(false)
  }

  const openEditEditor = (question: ManagedQuestion) => {
    setEditingUid(question.uid)
    setQuestionText(question.question_text)
    setMarks((question.marks ?? 1).toString())
    setOptions((question.options || []).map((option) => option.option_text))
    const correctIndex = (question.options || []).findIndex((option) => option.is_correct)
    setCorrectOptionIndex(correctIndex === -1 ? 0 : correctIndex)
    setEditorMode('edit')
    setBulkUploadOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitQuestion = async () => {
    if (!questionText.trim()) return window.alert('Question text is required')
    if (options.some((option) => !option.trim())) return window.alert('All options must have text')

    const saved = await manager.saveQuestion(
      {
        question_text: questionText,
        marks: parseFloat(marks) || 1,
        options,
        correct_answer: options[correctOptionIndex],
      },
      editorMode === 'edit' ? editingUid || undefined : undefined,
    )
    if (saved) resetEditor()
  }

  const submitBulkUpload = async () => {
    try {
      const data: unknown = JSON.parse(bulkData)
      if (!Array.isArray(data)) throw new Error('Data must be an array of questions')
      if (await manager.uploadQuestions(data)) {
        setBulkData('')
        setBulkUploadOpen(false)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      manager.setError(`Invalid JSON format: ${message}`)
    }
  }

  const openBulkUpload = () => {
    resetEditor()
    setBulkUploadOpen(true)
  }

  const editorOpen = editorMode !== 'closed'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 md:text-xl">
          Exam Questions ({manager.questions.length})
        </h2>
        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
          <button onClick={openCreateEditor} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 md:order-3 md:col-span-1 md:py-2">
            <Plus size={16} /> Add Question
          </button>
          {manager.selectedUids.length > 0 && (
            <button onClick={manager.deleteSelectedQuestions} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 md:order-2 md:border-0 md:bg-transparent md:px-4 md:py-2">
              <Trash2 size={16} /> Delete ({manager.selectedUids.length})
            </button>
          )}
          <button onClick={openBulkUpload} className={`inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 md:order-1 md:px-4 md:py-2 ${manager.selectedUids.length === 0 ? 'col-span-2' : ''}`}>
            <FileUp size={16} /> Bulk JSON
          </button>
        </div>
      </div>

      {manager.error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600 animate-in fade-in zoom-in-95 duration-200">
          <AlertCircle size={18} /> {manager.error}
          <button onClick={manager.clearError} className="ml-auto opacity-50 hover:opacity-100" aria-label="Dismiss error"><X size={14} /></button>
        </div>
      )}
      {manager.success && (
        <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-600 animate-in fade-in zoom-in-95 duration-200">
          <CheckCircle size={18} /> {manager.success}
          <button onClick={manager.clearSuccess} className="ml-auto opacity-50 hover:opacity-100" aria-label="Dismiss success message"><X size={14} /></button>
        </div>
      )}

      {editorOpen && (
        <QuestionEditor
          editing={editorMode === 'edit'}
          loading={manager.loading}
          questionText={questionText}
          marks={marks}
          options={options}
          correctOptionIndex={correctOptionIndex}
          onQuestionTextChange={setQuestionText}
          onMarksChange={setMarks}
          onOptionsChange={setOptions}
          onCorrectOptionChange={setCorrectOptionIndex}
          onSubmit={() => void submitQuestion()}
          onCancel={resetEditor}
        />
      )}

      {bulkUploadOpen && (
        <BulkQuestionUpload
          value={bulkData}
          loading={manager.loading}
          onChange={setBulkData}
          onSubmit={() => void submitBulkUpload()}
          onCancel={() => setBulkUploadOpen(false)}
        />
      )}

      <QuestionList
        questions={manager.questions}
        selectedUids={manager.selectedUids}
        loading={manager.loading}
        editorOpen={editorOpen}
        bulkUploadOpen={bulkUploadOpen}
        onToggleQuestion={manager.toggleQuestion}
        onToggleAll={manager.toggleAllQuestions}
        onEdit={openEditEditor}
        onDelete={(uid) => void manager.deleteQuestion(uid)}
      />
    </div>
  )
}
