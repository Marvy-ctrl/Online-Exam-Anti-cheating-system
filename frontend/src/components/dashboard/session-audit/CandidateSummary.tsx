import { AlertTriangle, Clock, Hash, Mail, TrendingUp } from 'lucide-react'
import type { SessionAuditDetails } from '@/src/types/session-audit'

export function CandidateSummary({ details, duration }: { details: SessionAuditDetails; duration: string }) {
  const initials = details.student_name.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase() || '??'
  const stats = [
    { label: 'Score', value: details.score !== null ? `${details.score} / ${details.total_marks || 0}` : '--', sub: 'Final result', icon: <TrendingUp size={13} className="text-blue-500" />, accent: 'border-slate-200' },
    { label: 'Violations', value: `${details.violations.length}`, sub: details.violations.length === 0 ? 'Clean session' : 'Events recorded', icon: <AlertTriangle size={13} className={details.violations.length === 0 ? 'text-green-500' : 'text-red-500'} />, accent: details.violations.length === 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50' },
    { label: 'Duration', value: duration, sub: 'Session length', icon: <Clock size={13} className="text-slate-400" />, accent: 'border-slate-200' },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0">{initials}</div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Candidate</p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight break-words">{details.student_name}</h1>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-1 sm:gap-4 mt-1.5">
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500"><Hash size={11} />{details.student_id}</span>
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 break-all"><Mail size={11} />{details.email}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 w-full sm:w-auto sm:grid-cols-3 sm:flex sm:items-stretch sm:gap-3">
          {stats.map((stat) => <div key={stat.label} className={`border rounded-xl p-3 sm:p-4 bg-white ${stat.accent}`}><div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">{stat.icon} {stat.label}</div><div className="text-lg sm:text-xl font-bold text-slate-900">{stat.value}</div><div className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</div></div>)}
        </div>
      </div>
    </div>
  )
}
