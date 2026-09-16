import Link from 'next/link'
import { Building2, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { InstitutionWorkspaceDetails } from '@/src/types/institution-workspace'

interface Props {
  institution: InstitutionWorkspaceDetails
  onCreateExam: () => void
  onCreateSubject: () => void
  onDelete: () => void
}

export function InstitutionWorkspaceHeader({ institution, onCreateExam, onCreateSubject, onDelete }: Props) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 font-medium min-w-0">
        <Link href="/dashboard/institutions" className="hover:text-blue-600 transition-colors">Institutions</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 truncate">{institution.name} Workspace</span>
      </div>
      <div className="flex flex-col gap-5 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
            {institution.logo_url ? (
              // Institution logos may be hosted on administrator-configured origins.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={institution.logo_url} alt={institution.name} className="w-full h-full object-contain" />
            ) : (
              <Building2 size={24} className="text-blue-500" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{institution.name}</h1>
            <p className="text-slate-500 text-sm">Institution Workspace</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:gap-3">
          <button onClick={onDelete} className="col-span-2 sm:col-auto px-4 py-2 text-red-600 font-medium transition-colors flex items-center justify-center gap-2" title="Delete Workspace">
            <Trash2 size={16} /> Delete
          </button>
          <button onClick={onCreateSubject} className="px-3 sm:px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
            <Plus size={16} /> Add Subject
          </button>
          <button onClick={onCreateExam} className="px-3 sm:px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
            <Plus size={16} /> Create Exam
          </button>
        </div>
      </div>
    </div>
  )
}
