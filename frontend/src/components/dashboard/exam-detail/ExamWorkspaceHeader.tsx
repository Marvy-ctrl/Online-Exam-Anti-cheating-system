import Link from 'next/link'
import { ChevronRight, FileText, Trash2, Users } from 'lucide-react'
import { getExamStatus } from '@/src/lib/admin-exam'
import type { AdminExam } from '@/src/types/admin-exam'

interface ExamWorkspaceHeaderProps {
  exam: AdminExam
  institutionUid: string
  monitoringConnected: boolean
  onDelete: () => void
}

export function ExamWorkspaceHeader({
  exam,
  institutionUid,
  monitoringConnected,
  onDelete,
}: ExamWorkspaceHeaderProps) {
  const status = getExamStatus(exam)

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-5 sm:mb-6 font-medium min-w-0">
        <Link
          href="/dashboard/institutions"
          className="hover:text-blue-600 transition-colors"
        >
          Institutions
        </Link>
        <ChevronRight size={14} />
        <Link
          href={`/dashboard/institutions/${institutionUid}`}
          className="hover:text-blue-600 transition-colors truncate"
        >
          Workspace
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 truncate max-w-[96px] sm:max-w-[200px]">
          {exam.title}
        </span>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 mb-6 sm:mb-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 sm:gap-6">
        <div className="w-full min-w-0">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <FileText size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
                  {exam.title}
                </h1>
                <span
                  className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
              {monitoringConnected && status.label === 'Active' && (
                <div className="mt-2 flex w-fit items-center gap-2 px-2 py-1 bg-green-50 border border-green-100 rounded-md">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">
                    Live Monitoring
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 sm:ml-[52px]">
            <span className="max-w-full truncate font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {exam.subject_name || 'No Subject Assigned'}
            </span>
            <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">
              {exam.uid.split('-')[0]}
            </span>
            <span>{exam.duration_minutes} Minutes</span>
          </div>
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:gap-3">
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-white text-red-600 font-medium rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Trash2 size={16} /> Delete Exam
          </button>
          <Link
            href={`/dashboard/institutions/${institutionUid}/exams/${exam.uid}/pre-enroll`}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Users size={16} /> Bulk Pre-Enroll
          </Link>
        </div>
      </div>
    </>
  )
}
