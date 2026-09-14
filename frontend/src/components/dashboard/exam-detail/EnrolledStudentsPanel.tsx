'use client'

import { useState } from 'react'
import { CheckCircle, Edit2, Loader2, ShieldCheck, Trash2, Users } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'
import type { EnrolledStudent } from '@/src/types/admin-exam'

interface EnrolledStudentsPanelProps {
  examUid: string
  students: EnrolledStudent[]
  onRefresh: () => Promise<void>
}

export function EnrolledStudentsPanel({ examUid, students, onRefresh }: EnrolledStudentsPanelProps) {
  const [selectedStudentUids, setSelectedStudentUids] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  function toggleStudent(uid: string) {
    setSelectedStudentUids((current) => {
      const next = new Set(current)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function toggleAll() {
    setSelectedStudentUids(
      selectedStudentUids.size === students.length
        ? new Set()
        : new Set(students.map((student) => student.uid)),
    )
  }

  async function removeSelectedStudents() {
    if (selectedStudentUids.size === 0 || !window.confirm(`Are you sure you want to remove ${selectedStudentUids.size} selected students?`)) return
    setIsBulkDeleting(true)
    try {
      const response = await apiFetch(`/exam/${examUid}/bulk-unenroll`, {
        method: 'POST',
        body: JSON.stringify({ student_uids: Array.from(selectedStudentUids) }),
      })
      if (!response.ok) {
        const result = await response.json()
        window.alert(result.detail || 'Failed to remove students')
        return
      }
      window.alert(`Removed ${selectedStudentUids.size} students`)
      setSelectedStudentUids(new Set())
      await onRefresh()
    } catch {
      window.alert('Network error')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  async function editStudent(student: EnrolledStudent) {
    const firstName = window.prompt('Enter new first name:', student.first_name)
    if (firstName === null) return
    const lastName = window.prompt('Enter new last name:', student.last_name)
    if (lastName === null) return
    const email = window.prompt('Enter new email:', student.email)
    if (email === null) return
    try {
      const response = await apiFetch(`/exam/students/${student.uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
      })
      if (response.ok) await onRefresh()
      else window.alert('Failed to update student.')
    } catch {
      window.alert('Error updating student.')
    }
  }

  async function removeStudent(studentUid: string) {
    if (!window.confirm('Remove this student from the exam? They will still exist in the Global Master roster.')) return
    try {
      const response = await apiFetch(`/exam/${examUid}/enrollment/${studentUid}`, { method: 'DELETE' })
      if (response.ok) await onRefresh()
      else window.alert('Failed to remove student.')
    } catch {
      window.alert('Error removing student.')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">Enrolled Students</h2>
          {selectedStudentUids.size > 0 && (
            <button onClick={removeSelectedStudents} disabled={isBulkDeleting} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 font-bold text-xs hover:bg-red-100 disabled:opacity-50">
              {isBulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete ({selectedStudentUids.size})
            </button>
          )}
        </div>
        <span className="px-3 py-1 bg-slate-100 text-slate-600 font-medium text-sm rounded-lg border border-slate-200">{students.length} Total</span>
      </div>

      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Users size={32} className="text-slate-300 mb-2" />
          <p className="text-slate-500 font-medium">No students enrolled</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">Use the Bulk Pre-Enroll tool to add students, or generate an enrollment link.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4 w-10"><input type="checkbox" className="rounded border-slate-300 text-blue-600" checked={selectedStudentUids.size === students.length} onChange={toggleAll} /></th>
              <th className="py-3 px-4">Student</th><th className="py-3 px-4">Email</th><th className="py-3 px-4">Reg Number</th><th className="py-3 px-4 text-center">Status</th><th className="py-3 px-4 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {students.map((student) => (
                <tr key={student.uid} className={`hover:bg-slate-50/50 group ${selectedStudentUids.has(student.uid) ? 'bg-blue-50/30' : ''}`}>
                  <td className="py-3 px-4"><input type="checkbox" className="rounded border-slate-300 text-blue-600" checked={selectedStudentUids.has(student.uid)} onChange={() => toggleStudent(student.uid)} /></td>
                  <td className="py-3 px-4 font-medium text-slate-900">{student.first_name} {student.last_name}</td>
                  <td className="py-3 px-4 text-slate-500">{student.email}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{student.student_id}</td>
                  <td className="py-3 px-4 text-center">
                    {student.status === 'enrolled' ? <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100"><CheckCircle size={12} /> Enrolled</span> : <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"><ShieldCheck size={12} /> Pending Validation</span>}
                  </td>
                  <td className="py-3 px-4 text-right"><div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <button onClick={() => editStudent(student)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="Edit Student Profile"><Edit2 size={16} /></button>
                    <button onClick={() => removeStudent(student.uid)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md" title="Remove From Exam"><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
