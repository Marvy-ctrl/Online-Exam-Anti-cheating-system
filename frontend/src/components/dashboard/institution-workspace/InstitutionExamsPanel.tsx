import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { InstitutionExam } from '@/src/types/institution-workspace'

function getExamStatus(exam: InstitutionExam) {
  const now = new Date()
  const start = new Date(exam.start_time)
  const end = new Date(exam.end_time)
  if (now < start) return { label: 'Upcoming', cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' }
  if (now > end) return { label: 'Closed', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return { label: 'Active', cls: 'bg-green-50 text-green-700 border-green-100' }
}

export function InstitutionExamsPanel({ exams, institutionUid }: { exams: InstitutionExam[]; institutionUid: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Active Exams</h2>
      {exams.length === 0 ? <p className="text-slate-500">No exams have been created for this institution yet.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map((exam) => {
            const status = getExamStatus(exam)
            return (
              <Link key={exam.uid} href={`/dashboard/institutions/${institutionUid}/exams/${exam.uid}`} className="group flex flex-col p-4 sm:p-5 border border-slate-200 rounded-xl hover:border-blue-300 transition-all bg-white">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{exam.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{exam.duration_minutes} minutes</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><ChevronRight size={18} /></div>
                </div>
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border ${status.cls}`}>{status.label}</span>
                  <span className="text-sm font-medium text-blue-600 sm:opacity-0 sm:-translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all">Manage Exam</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
