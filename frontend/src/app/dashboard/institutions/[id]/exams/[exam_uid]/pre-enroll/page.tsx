"use client"
import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/src/lib/api'
import { ChevronLeft, Plus, Users, Save, Trash2, ShieldCheck, User } from 'lucide-react'
import Link from 'next/link'

interface StudentInput {
  first_name: string
  last_name: string
  email: string
  student_id: string
}

export default function BulkPreEnrollPage() {
  const params = useParams()
  const router = useRouter()
  const { id, exam_uid } = params as { id: string, exam_uid: string }

  const [students, setStudents] = useState<StudentInput[]>([
    { first_name: '', last_name: '', email: '', student_id: '' }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleAddRow = () => {
    setStudents([...students, { first_name: '', last_name: '', email: '', student_id: '' }])
  }

  const handleRemoveRow = (index: number) => {
    if (students.length === 1) return; // keep at least one
    const newStudents = [...students]
    newStudents.splice(index, 1)
    setStudents(newStudents)
  }

  const handleChange = (index: number, field: keyof StudentInput, value: string) => {
    const newStudents = [...students]
    newStudents[index][field] = value
    setStudents(newStudents)
  }

  const handleSubmit = async () => {
    // Basic validation
    const validStudents = students.filter(
      s => s.first_name.trim() && s.last_name.trim() && s.email.trim() && s.student_id.trim()
    )

    if (validStudents.length === 0) {
      alert("Please fill completely at least one student row.")
      return
    }

    setIsSubmitting(true)
    try {
      let res: Response;
      if (validStudents.length === 1) {
        // Use single endpoint so we get the 409 Conflict error for duplicates
        res = await apiFetch(`/exam/${exam_uid}/pre-enroll`, {
          method: 'POST',
          body: JSON.stringify(validStudents[0])
        })
      } else {
        res = await apiFetch(`/exam/${exam_uid}/bulk-pre-enroll`, {
          method: 'POST',
          body: JSON.stringify({ students: validStudents })
        })
      }

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push(`/dashboard/institutions/${id}/exams/${exam_uid}`)
        }, 1500)
      } else {
        const errorData = await res.json()
        alert(`Failed to bulk enroll: ${errorData.detail || "Unknown error"}`)
      }
    } catch (e) {
      alert("An error occurred during submission.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-5xl mx-auto">
        
        {/* Navigation & Header */}
        <div className="flex flex-col gap-6 mb-8">
          <Link 
            href={`/dashboard/institutions/${id}/exams/${exam_uid}`} 
            className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors w-max font-medium"
          >
            <ChevronLeft size={16} />
            Back to Exam Detail
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Users className="text-blue-600" size={32} />
                Bulk Pre-Enroll Students
              </h1>
              <p className="text-slate-500 mt-2 flex items-center gap-2">
                {/* <ShieldCheck size={16} className="text-green-500" /> */}
                These students will be whitelisted for entry into the exam and students will be granted access to this exam.
              </p>
            </div>
            
            {/* <div className="hidden lg:block bg-blue-50 text-blue-800 px-4 py-2 rounded-xl border border-blue-100 font-medium">
              Target Exam UID: <span className="font-mono text-sm opacity-80 ml-1">{exam_uid.slice(0, 8)}...</span>
            </div> */}
          </div>
        </div>

        {/* Dynamic Form Controller */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-4 px-6 flex justify-between items-center">
            <h2 className="font-semibold text-slate-700">Student Entry Form</h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200">
              {students.length} Row{students.length !== 1 && 's'}
            </span>
          </div>

          <div className="p-6 space-y-4">
            {/* Headers (Desktop only) */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_1.5fr_1fr_40px] gap-4 mb-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>First Name</span>
              <span>Last Name</span>
              <span>Email Address</span>
              <span>Student ID</span>
              <span></span>
            </div>

            {/* Dynamic Rows */}
            {students.map((student, index) => (
              <div 
                key={index} 
                className="group flex flex-col md:grid md:grid-cols-[1fr_1fr_1.5fr_1fr_40px] gap-3 md:gap-4 p-4 md:p-2 bg-slate-50 md:bg-transparent rounded-xl md:rounded-none border border-slate-100 md:border-none focus-within:bg-blue-50/30 transition-colors duration-200"
              >
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-400 md:hidden" size={16} />
                  <input
                    type="text"
                    placeholder="First Name"
                    value={student.first_name}
                    onChange={(e) => handleChange(index, 'first_name', e.target.value)}
                    className="w-full pl-10 md:pl-4 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={student.last_name}
                    onChange={(e) => handleChange(index, 'last_name', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus: border-blue-500 outline-none transition-all text-sm placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={student.email}
                    onChange={(e) => handleChange(index, 'email', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Student ID (e.g. STU-001)"
                    value={student.student_id}
                    onChange={(e) => handleChange(index, 'student_id', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-mono placeholder:font-sans placeholder:text-slate-400"
                  />
                </div>
                <div className="flex items-center justify-end md:justify-center">
                  <button
                    onClick={() => handleRemoveRow(index)}
                    disabled={students.length === 1}
                    className={`p-2 rounded-xl transition-all duration-200 ${
                      students.length === 1 
                        ? 'text-slate-300 cursor-not-allowed' 
                        : 'text-slate-400 hover:bg-red-50 hover:text-red-500 focus:bg-red-50 focus:text-red-500'
                    }`}
                    title="Remove row"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 border-t border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              onClick={handleAddRow}
              className="w-full sm:w-auto px-5 py-2.5 bg-white border border-dashed border-blue-300 text-blue-600 font-medium rounded-xl hover:bg-blue-50 hover:border-blue-500 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Add Student Row
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || success}
              className={`w-full sm:w-auto px-8 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${
                success 
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/25' 
                  : isSubmitting 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25'
              }`}
            >
              {success ? (
                <>Saved Successfully!</>
              ) : isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                  Saving Roster...
                </>
              ) : (
                <>
                  Save All Students
                </>
              )}
            </button>
          </div>
        </div>
        
      </div>
    </div>
  )
}
