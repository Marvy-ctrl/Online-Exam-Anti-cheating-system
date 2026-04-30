"use client"
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, BookOpen, FileText, Plus, Trash2, Edit2 } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/src/lib/api'
import CreateExamModal from '@/src/components/dashboard/CreateExamModal'

interface Subject {
  uid: string
  name: string
  institution_uid: string
}

interface Exam {
  uid: string
  title: string
  duration_minutes: number
  start_time: string
  end_time: string
}

export default function SubjectWorkspace() {
  const params = useParams()
  const router = useRouter()
  const { id, subject_uid } = params as { id: string, subject_uid: string }

  const [subject, setSubject] = useState<Subject | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isExamModalOpen, setIsExamModalOpen] = useState(false)

  const fetchSubjectData = async () => {
    setLoading(true)
    try {
      // 1. Fetch Subject Details
      const subRes = await apiFetch(`/exam/subject/${subject_uid}`)
      if (!subRes.ok) throw new Error("Subject not found")
      const subData = await subRes.json()
      setSubject(subData)

      // 2. Fetch Exams for this subject
      const examRes = await apiFetch(`/exam/get_all_exams?subject_uid=${subject_uid}`)
      if (examRes.ok) {
        setExams(await examRes.json())
      }
    } catch (err) {
      console.error(err)
      router.push(`/dashboard/institutions/${id}`) // gracefully fallback
    } finally {
      setLoading(false)
    }
  }

  const getExamStatus = (exam: Exam) => {
    const now = new Date()
    const start = new Date(exam.start_time)
    const end = new Date(exam.end_time)
    if (now < start) return { label: 'Upcoming', cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' }
    if (now > end) return { label: 'Closed', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
    return { label: 'Active', cls: 'bg-green-50 text-green-700 border-green-100' }
  }

  useEffect(() => {
    if (subject_uid) fetchSubjectData()
  }, [subject_uid])

  if (loading || !subject) {
    return <div className="p-8 flex items-center justify-center text-slate-400 min-h-[50vh]">Loading Subject Details...</div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 font-medium">
        <Link href="/dashboard/institutions" className="hover:text-blue-600 transition-colors">Institutions</Link>
        <ChevronRight size={14} />
        <Link href={`/dashboard/institutions/${id}`} className="hover:text-blue-600 transition-colors">Workspace</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 truncate max-w-[200px]">{subject.name}</span>
      </div>

      {/* Header Context */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <BookOpen size={20} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{subject.name}</h1>
          </div>
          <p className="text-slate-500 text-sm ml-13 flex items-center gap-2">
            <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">
              Subject ID: {subject_uid.split('-')[0]}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsExamModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20"
          >
            <Plus size={16}/> Create Exam
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 min-h-[400px]">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Exams for {subject.name}</h2>
        {exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
             <FileText size={32} className="text-slate-300 mb-2" />
             <p className="text-slate-500 font-medium">No exams found</p>
             <p className="text-sm text-slate-400 mt-1 max-w-sm">Create an exam under this subject to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((exam: Exam) => (
              <Link 
                key={exam.uid} 
                href={`/dashboard/institutions/${id}/exams/${exam.uid}`}
                className="group flex flex-col p-5 border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all bg-white"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{exam.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{exam.duration_minutes} minutes</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <ChevronRight size={18} />
                  </div>
                </div>
                
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border ${getExamStatus(exam).cls}`}>
                    {getExamStatus(exam).label}
                  </span>
                  <span className="text-sm font-medium text-blue-600 opacity-0 (-translate-x-2) group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                    Manage Exam
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <CreateExamModal 
        isOpen={isExamModalOpen} 
        onClose={() => setIsExamModalOpen(false)} 
        institutionUid={id}
        subjects={[subject]}
        onSuccess={fetchSubjectData} 
      />
    </div>
  )
}
