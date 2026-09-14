'use client'

import { useState } from 'react'
import { CheckCircle, Copy } from 'lucide-react'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { apiFetch } from '@/src/lib/api'
import type { AdminExam, EnrolledStudent } from '@/src/types/admin-exam'

interface ExamOverviewPanelProps {
  exam: AdminExam
  students: EnrolledStudent[]
  onRefresh: () => Promise<void>
}

export function ExamOverviewPanel({ exam, students, onRefresh }: ExamOverviewPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [isGeneratingExamLink, setIsGeneratingExamLink] = useState(false)
  const [isSendingExamLink, setIsSendingExamLink] = useState(false)
  const [examLinkCopySuccess, setExamLinkCopySuccess] = useState(false)
  const [sendExamLinkSuccess, setSendExamLinkSuccess] = useState(false)
  const [linkStartTime, setLinkStartTime] = useState<Date | undefined>(() =>
    exam.link_start_time || exam.start_time
      ? new Date(exam.link_start_time || exam.start_time)
      : undefined,
  )
  const [linkEndTime, setLinkEndTime] = useState<Date | undefined>(() =>
    exam.link_end_time || exam.end_time
      ? new Date(exam.link_end_time || exam.end_time)
      : undefined,
  )
  const [isEditingLink, setIsEditingLink] = useState(false)

  const pendingStudents = students.filter((student) => student.status !== 'enrolled')
  const enrolledStudents = students.filter((student) => student.status === 'enrolled')

  async function generateEnrollmentLink() {
    setIsGenerating(true)
    try {
      const response = await apiFetch(`/exam/${exam.uid}/enroll_link`, {
        method: 'POST',
        body: JSON.stringify({
          link_start_time: linkStartTime?.toISOString() || null,
          link_end_time: linkEndTime?.toISOString() || null,
        }),
      })
      if (!response.ok) {
        window.alert('Failed to generate enrollment link.')
        return
      }
      await onRefresh()
      setIsEditingLink(false)
    } catch {
      window.alert('Error generating link.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function sendInvitations() {
    if (students.length === 0) {
      window.alert('No students are enrolled in this exam yet.')
      return
    }
    setIsSending(true)
    try {
      const response = await apiFetch(`/exam/${exam.uid}/send-invitations`, {
        method: 'POST',
        body: JSON.stringify({ custom_message: customMessage }),
      })
      if (!response.ok) {
        const result = await response.json()
        window.alert(`Failed to send invitations: ${result.detail || 'Unknown error'}`)
        return
      }
      setSendSuccess(true)
      window.setTimeout(() => setSendSuccess(false), 3000)
    } catch {
      window.alert('Error sending invitations.')
    } finally {
      setIsSending(false)
    }
  }

  function copyToClipboard(text: string, type: 'enroll' | 'exam') {
    void navigator.clipboard.writeText(text)
    const setSuccess = type === 'exam' ? setExamLinkCopySuccess : setCopySuccess
    setSuccess(true)
    window.setTimeout(() => setSuccess(false), 2000)
  }

  async function generateExamLink() {
    setIsGeneratingExamLink(true)
    try {
      const response = await apiFetch(`/exam/${exam.uid}/exam-link`, { method: 'POST' })
      if (!response.ok) {
        const result = await response.json()
        window.alert(`Failed to generate exam link: ${result.detail || 'Unknown error'}`)
        return
      }
      await onRefresh()
    } catch {
      window.alert('Error generating exam link.')
    } finally {
      setIsGeneratingExamLink(false)
    }
  }

  async function sendExamLink() {
    if (enrolledStudents.length === 0) {
      window.alert('No fully enrolled students found. Students must complete face registration before you can send the exam link.')
      return
    }
    setIsSendingExamLink(true)
    try {
      const response = await apiFetch(`/exam/${exam.uid}/send-exam-link`, { method: 'POST' })
      if (!response.ok) {
        const result = await response.json()
        window.alert(`Failed to send exam link: ${result.detail || 'Unknown error'}`)
        return
      }
      setSendExamLinkSuccess(true)
      window.setTimeout(() => setSendExamLinkSuccess(false), 3000)
    } catch {
      window.alert('Error sending exam link.')
    } finally {
      setIsSendingExamLink(false)
    }
  }

  const enrollmentWindowDialog = (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          {exam.enroll_link ? 'Update Enrollment Window' : 'Configure Enrollment Window'}
        </h3>
        <p className="text-sm text-slate-500 mb-6">Set when students are allowed to use this link.</p>
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enrollment Opens</label>
            <DateTimePicker date={linkStartTime} setDate={setLinkStartTime} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enrollment Closes (Expiry)</label>
            <DateTimePicker date={linkEndTime} setDate={setLinkEndTime} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsEditingLink(false)} className="flex-1 py-2.5 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100">Cancel</button>
          <button onClick={generateEnrollmentLink} disabled={isGenerating} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {isGenerating ? 'Saving...' : exam.enroll_link ? 'Update Link' : 'Generate Link'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Exam Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</div>
            <div className="text-slate-900 font-medium">{exam.duration_minutes} Minutes</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Time Window</div>
            <div className="text-slate-900 font-medium text-sm">{new Date(exam.start_time).toLocaleString()} - {new Date(exam.end_time).toLocaleString()}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Description</h2>
        <p className="text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">{exam.description || 'No description provided for this exam.'}</p>
      </section>

      <section className="pt-6 border-t border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Enrollment & Invitations</h2>
        {!exam.enroll_link ? (
          <div className="border border-blue-100 rounded-2xl p-6 text-center">
            <h3 className="font-bold mb-1">No Enrollment Link Generated</h3>
            <p className="text-sm mb-6 max-w-md mx-auto">Students need a secure link to verify their identities and join this exam.</p>
            <button onClick={() => setIsEditingLink(true)} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">Setup Enrollment Link</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Secure Enrollment Link</span>
                <button onClick={() => setIsEditingLink(true)} className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">Update Window</button>
              </div>
              <div className="text-[11px] font-medium text-slate-600 mb-4">
                {exam.link_start_time ? new Date(exam.link_start_time).toLocaleString() : 'N/A'} <span className="mx-1 text-slate-300">→</span>
                <span className={new Date(exam.link_end_time || '') < new Date() ? 'text-red-500' : ''}>{exam.link_end_time ? new Date(exam.link_end_time).toLocaleString() : 'No Deadline'}</span>
              </div>
              <div className="flex gap-2">
                <input readOnly value={exam.enroll_link} className="flex-1 min-w-0 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono text-slate-600 outline-none" />
                <button onClick={() => copyToClipboard(exam.enroll_link!, 'enroll')} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50" title="Copy Link">
                  {copySuccess ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}
                </button>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <h3 className="font-bold text-slate-900 mb-4">Send Email Invitations</h3>
              <textarea placeholder="Add an optional message..." value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} className="w-full text-sm p-3 border border-slate-200 rounded-xl outline-none min-h-[100px] resize-none mb-4" />
              <button onClick={sendInvitations} disabled={isSending || pendingStudents.length === 0} className={`w-full py-3 rounded-xl font-bold transition-all ${sendSuccess ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'}`}>
                {isSending ? 'Sending...' : sendSuccess ? 'Invitations Sent!' : `Send to ${pendingStudents.length} Pending Students`}
              </button>
              {pendingStudents.length === 0 && students.length > 0 && <p className="text-center text-[11px] text-green-500 mt-2 font-medium">All students have successfully enrolled.</p>}
              {students.length === 0 && <p className="text-center text-[11px] text-red-500 mt-2 font-medium">You must add students first.</p>}
            </div>
          </div>
        )}
      </section>

      <section className="pt-6 border-t border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Exam Entry Link</h2>
        <p className="text-xs md:text-sm text-slate-500 mb-4">The link is valid during the exam window ({new Date(exam.start_time).toLocaleString()} → {new Date(exam.end_time).toLocaleString()}).</p>
        {!exam.exam_link ? (
          <div className="border border-green-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div><h3 className="font-bold text-green-900 mb-1">No Exam Link Generated Yet</h3><p className="text-green-700 text-sm">Generate a link to allow enrolled students to enter the exam.</p></div>
            <button onClick={generateExamLink} disabled={isGeneratingExamLink} className="shrink-0 px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50">{isGeneratingExamLink ? 'Generating...' : 'Generate Exam Link'}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-3"><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exam Entry Link</span><button onClick={generateExamLink} disabled={isGeneratingExamLink} className="text-[10px] font-bold text-green-600 hover:bg-green-50 px-2 py-1 rounded disabled:opacity-50">{isGeneratingExamLink ? 'Regenerating...' : 'Regenerate'}</button></div>
              <div className="flex gap-2"><input readOnly value={exam.exam_link} className="flex-1 min-w-0 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono text-slate-600 outline-none" /><button onClick={() => copyToClipboard(exam.exam_link!, 'exam')} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50" title="Copy Link">{examLinkCopySuccess ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}</button></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="font-bold text-slate-900 mb-1">Send to Enrolled Students</h3>
              <p className="text-xs text-slate-500 mb-4">Send the exam link to all <strong>{enrolledStudents.length}</strong> fully enrolled students.</p>
              <button onClick={sendExamLink} disabled={isSendingExamLink || sendExamLinkSuccess || enrolledStudents.length === 0} className={`w-full py-3 rounded-xl font-bold ${sendExamLinkSuccess ? 'bg-green-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50'}`}>{isSendingExamLink ? 'Sending...' : sendExamLinkSuccess ? 'Exam Links Sent!' : 'Send Exam Link to Students'}</button>
              {enrolledStudents.length === 0 && <p className="text-center text-[11px] text-amber-600 mt-2 font-medium">Students must complete face registration first.</p>}
            </div>
          </div>
        )}
      </section>

      {isEditingLink && enrollmentWindowDialog}
    </div>
  )
}
