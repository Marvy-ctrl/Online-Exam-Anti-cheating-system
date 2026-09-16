import { Edit2, Users } from 'lucide-react'
import type { InstitutionStudent } from '@/src/types/institution-workspace'

export function InstitutionStudentsPanel({ students, onEdit }: { students: InstitutionStudent[]; onEdit: (student: InstitutionStudent) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">Global Student Directory</h2>
        <span className="px-3 py-1 bg-slate-100 text-slate-600 font-medium text-sm rounded-lg border border-slate-200">{students.length} Total</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">This view contains all students across all exams in this institution.</p>
      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Users size={32} className="text-slate-300 mb-2" />
          <p className="text-slate-500 font-medium">No students enrolled</p>
          <p className="text-sm text-slate-400">Students will appear here once they accept an exam link or are bulk pre-enrolled.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead><tr className="border-b border-slate-200 text-sm font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Student</th><th className="py-3 px-4">Email</th><th className="py-3 px-4">Reg No</th><th className="py-3 px-4 text-center">Status</th><th className="py-3 px-4 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => (
                <tr key={student.uid} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-3 px-4"><div className="font-medium text-slate-900">{student.first_name} {student.last_name}</div></td>
                  <td className="py-3 px-4 text-sm text-slate-500">{student.email}</td>
                  <td className="py-3 px-4 text-sm font-mono text-slate-600">{student.student_id}</td>
                  <td className="py-3 px-4 text-center"><span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-slate-700">Pre-Enrolled</span></td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => onEdit(student)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" title="Edit Global Profile"><Edit2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
