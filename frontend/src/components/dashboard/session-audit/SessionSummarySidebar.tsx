import { AlertTriangle, Clock } from 'lucide-react'
import type { SessionAuditDetails } from '@/src/types/session-audit'
import { getViolationConfig } from './violation-config'

export function SessionSummarySidebar({ details, duration }: { details: SessionAuditDetails; duration: string }) {
  const counts = details.violations.reduce<Record<string, number>>((result, violation) => {
    result[violation.type] = (result[violation.type] ?? 0) + 1
    return result
  }, {})
  const timeline = [
    { label: 'Started', time: new Date(details.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), date: new Date(details.start_time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), dot: 'bg-blue-500' },
    { label: 'Ended', time: details.end_time ? new Date(details.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'In Progress', date: details.end_time ? new Date(details.end_time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '--', dot: details.end_time ? 'bg-green-500' : 'bg-amber-400 animate-pulse' },
    { label: 'Duration', time: duration, date: 'Total session length', dot: 'bg-slate-300' },
  ]
  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2"><Clock size={13} className="text-slate-400" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session Timeline</span></div>
        <div className="divide-y divide-slate-100">{timeline.map((row) => <div key={row.label} className="px-5 py-4 flex items-start gap-3"><div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${row.dot}`} /><div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{row.label}</p><p className="text-sm font-bold text-slate-800 mt-0.5">{row.time}</p><p className="text-[11px] text-slate-400 mt-0.5">{row.date}</p></div></div>)}</div>
      </div>
      {Object.keys(counts).length > 0 && <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2"><AlertTriangle size={13} className="text-slate-400" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Violation Breakdown</span></div><div className="p-4 space-y-2">{Object.entries(counts).map(([type, count]) => { const config = getViolationConfig(type); return <div key={type} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${config.bgColor} ${config.borderColor}`}><span className={`flex items-center gap-2 text-xs font-semibold ${config.textColor}`}>{config.icon} {config.label}</span><span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${config.badgeBg} ${config.badgeText}`}>{count}×</span></div> })}</div></div>}
      {details.adjustment_reason && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5"><p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider mb-1.5">Score Adjustment</p><p className="text-sm text-amber-900 leading-relaxed">{details.adjustment_reason}</p></div>}
      {details.violations.length === 0 && <div className="border border-slate-200 rounded-2xl p-6 text-center"><p className="font-bold text-black text-sm">Zero Violations</p><p className="text-xs text-black mt-1">Full compliance</p></div>}
    </div>
  )
}
