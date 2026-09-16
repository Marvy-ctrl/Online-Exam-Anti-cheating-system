import Link from 'next/link'
import { BookOpen, Edit2, Trash2 } from 'lucide-react'
import type { InstitutionSubject } from '@/src/types/institution-workspace'

interface Props {
  institutionUid: string
  subjects: InstitutionSubject[]
  onDelete: (subjectUid: string) => void
  onEdit: (subject: InstitutionSubject) => void
}

export function InstitutionSubjectsPanel({ institutionUid, subjects, onDelete, onEdit }: Props) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Subjects Directory</h2>
      {subjects.length === 0 ? <p className="text-slate-500">No subjects defined in this workspace.</p> : (
        <ul className="divide-y divide-slate-100">
          {subjects.map((subject) => (
            <li key={subject.uid} className="py-3 flex items-center justify-between group hover:bg-gray-50 px-2 rounded-lg">
              <Link href={`/dashboard/institutions/${institutionUid}/subjects/${subject.uid}`} className="flex items-center gap-3 flex-1 group/link">
                <BookOpen size={16} className="text-blue-500 group-hover/link:text-blue-600" />
                <span className="font-medium text-slate-700 group-hover/link:text-blue-600 transition-colors">{subject.name}</span>
              </Link>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(subject)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Edit Subject"><Edit2 size={16} /></button>
                <button onClick={() => onDelete(subject.uid)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete Subject"><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
