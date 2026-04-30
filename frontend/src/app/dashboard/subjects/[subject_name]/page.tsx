"use client"
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, BookOpen, FileText, Building2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/src/lib/api'

interface Subject {
  uid: string
  name: string
  institution_uid: string
}

interface Institution {
  uid: string
  name: string
  logo_url: string | null
}

interface Exam {
  uid: string
  title: string
  duration_minutes: number
  start_time: string
  end_time: string
  subject_uid: string
  institution_uid: string
}

interface GroupedExams {
  institution: Institution
  exams: Exam[]
}

export default function GlobalSubjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  // subject_name comes from the URL, so we decode it
  const { subject_name } = params as { subject_name: string }
  const decodedName = decodeURIComponent(subject_name)

  const [loading, setLoading] = useState(true)
  const [institutionsOffering, setInstitutionsOffering] = useState<Institution[]>([])
  const [groupedExams, setGroupedExams] = useState<GroupedExams[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      // 1. Fetch all required data concurrently
      const [subRes, instRes, examRes] = await Promise.all([
        apiFetch("/exam/subjects"),
        apiFetch("/institutions"),
        apiFetch("/exam/get_all_exams")
      ])
      
      if (!subRes.ok || !instRes.ok || !examRes.ok) {
        throw new Error("Failed to fetch required data")
      }

      const allSubjects: Subject[] = await subRes.json()
      const allInstitutions: Institution[] = await instRes.json()
      const allExams: Exam[] = await examRes.json()

      // 2. Find all subject records that match this name (case-insensitive)
      const matchedSubjects = allSubjects.filter(
        sub => sub.name.toLowerCase() === decodedName.toLowerCase()
      )

      if (matchedSubjects.length === 0) {
        router.push("/dashboard/subjects")
        return
      }

      // We'll use the proper cased name from the first matched subject just in case
      const properName = matchedSubjects[0].name

      // 3. Find the institutions offering this subject
      const instMap = new Map(allInstitutions.map(inst => [inst.uid, inst]))
      const matchedInsts: Institution[] = []
      
      matchedSubjects.forEach(sub => {
        const inst = instMap.get(sub.institution_uid)
        if (inst && !matchedInsts.find(i => i.uid === inst.uid)) {
          matchedInsts.push(inst)
        }
      })
      setInstitutionsOffering(matchedInsts)

      // 4. Find all exams belonging to these subject records
      const subjectUids = matchedSubjects.map(s => s.uid)
      const matchedExams = allExams.filter(exam => subjectUids.includes(exam.subject_uid))

      // 5. Group the exams by institution
      const groups = new Map<string, GroupedExams>()
      
      matchedInsts.forEach(inst => {
        groups.set(inst.uid, { institution: inst, exams: [] })
      })

      matchedExams.forEach(exam => {
        if (groups.has(exam.institution_uid)) {
          groups.get(exam.institution_uid)!.exams.push(exam)
        }
      })

      // Convert to array and filter out institutions that might have no exams? 
      // Or keep them so the user sees the institution offers the subject but has no exams yet.
      setGroupedExams(Array.from(groups.values()))

    } catch (err) {
      console.error(err)
      router.push('/dashboard/subjects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (subject_name) loadData()
  }, [subject_name])

  const getExamStatus = (exam: Exam) => {
    const now = new Date()
    const start = new Date(exam.start_time)
    const end = new Date(exam.end_time)
    if (now < start) return { label: 'Upcoming', cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' }
    if (now > end) return { label: 'Closed', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
    return { label: 'Active', cls: 'bg-green-50 text-green-700 border-green-100' }
  }

  if (loading) {
    return <div className="p-8 flex items-center justify-center text-slate-400 min-h-[50vh]">Loading Subject Details...</div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 font-medium">
        <Link href="/dashboard/subjects" className="hover:text-blue-600 transition-colors">All Subjects</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 truncate max-w-[200px]">{decodedName}</span>
      </div>

      {/* Header Context */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <BookOpen size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{decodedName}</h1>
            <p className="text-slate-500 mt-1">Global Subject Aggregation</p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 size={16} /> Offered In
          </h3>
          <div className="flex flex-wrap gap-3">
            {institutionsOffering.map(inst => (
              <Link 
                key={inst.uid} 
                href={`/dashboard/institutions/${inst.uid}`}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                {inst.logo_url ? (
                   <img src={inst.logo_url} alt={inst.name} className="w-5 h-5 rounded-md object-cover" />
                ) : (
                   <Building2 size={14} className="text-slate-400 group-hover:text-blue-500" />
                )}
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{inst.name}</span>
                <ExternalLink size={12} className="text-slate-400 group-hover:text-blue-500 ml-1" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {groupedExams.map(group => (
          <div key={group.institution.uid} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {group.institution.logo_url ? (
                   <img src={group.institution.logo_url} alt={group.institution.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 bg-white" />
                ) : (
                   <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                     <Building2 size={16} />
                   </div>
                )}
                <h2 className="font-bold text-slate-900">{group.institution.name}</h2>
              </div>
              <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg">
                {group.exams.length} Exam{group.exams.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="p-6">
              {group.exams.length === 0 ? (
                <div className="text-center py-8 text-slate-500 flex flex-col items-center">
                  <FileText size={24} className="text-slate-300 mb-2" />
                  <p>No exams created for {decodedName} at {group.institution.name} yet.</p>
                  <Link 
                    href={`/dashboard/institutions/${group.institution.uid}`}
                    className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Go to Workspace →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.exams.map((exam: Exam) => (
                    <Link 
                      key={exam.uid} 
                      href={`/dashboard/institutions/${group.institution.uid}/exams/${exam.uid}`}
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
          </div>
        ))}
      </div>
    </div>
  )
}
