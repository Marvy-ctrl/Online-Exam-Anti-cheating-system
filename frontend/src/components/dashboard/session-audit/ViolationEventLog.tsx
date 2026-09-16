'use client'

import { useState } from 'react'
import type { AuditViolation } from '@/src/types/session-audit'
import { getViolationConfig, SEVERITY_BADGE } from './violation-config'

export function ViolationEventLog({ violations }: { violations: AuditViolation[] }) {
  const [showAll, setShowAll] = useState(false)
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-7 py-4 border-b border-slate-100 flex items-center justify-between">
        <div><h3 className="text-sm font-bold text-slate-900">Student Event Log</h3><p className="text-[10px] text-slate-400">Violation record</p></div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${violations.length === 0 ? 'text-black' : 'bg-red-50 text-red-600 border-red-200'}`}>{violations.length} events</span>
      </div>
      <div className="p-4 sm:p-7">
        {violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center"><h4 className="text-base sm:text-lg font-bold text-slate-900 mb-1">No violations Detected</h4><p className="text-sm text-slate-400 max-w-xs">The candidate maintained full compliance throughout the examination session.</p></div>
        ) : (
          <div className="relative">
            <div className="absolute left-[14px] sm:left-[15px] top-5 bottom-5 w-px bg-slate-100" />
            <div className="space-y-4">
              {violations.slice(0, showAll ? undefined : 6).map((violation, index) => {
                const config = getViolationConfig(violation.type)
                const time = new Date(violation.time)
                return <div key={`${violation.time}-${index}`} className="relative flex gap-3 sm:gap-5 group">
                  <div className={`relative z-10 w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 rounded-full border-2 ${config.borderColor} ${config.bgColor} flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform ${config.textColor}`}>{config.icon}</div>
                  <div className={`flex-1 border ${config.borderColor} ${config.bgColor} rounded-xl p-3 sm:p-4 transition-shadow`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div><div className="flex flex-wrap items-center gap-2 mb-1"><span className={`text-sm font-bold ${config.textColor}`}>{config.label}</span><span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${SEVERITY_BADGE[config.severity]}`}>{config.severity}</span></div><p className="text-xs text-slate-500 leading-relaxed">Security violation logged.</p></div>
                      <div className="text-left sm:text-right flex-shrink-0"><p className={`font-mono text-xs sm:text-sm font-bold ${config.textColor}`}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p><p className="text-[10px] text-slate-400 mt-0.5">{time.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p><p className="text-[9px] text-slate-300 font-bold mt-1">{String(index + 1).padStart(3, '0')}</p></div>
                    </div>
                  </div>
                </div>
              })}
            </div>
            {violations.length > 6 && <div className="mt-6 text-center border-t border-slate-100 pt-4"><button onClick={() => setShowAll((current) => !current)} className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all inline-flex items-center justify-center gap-1.5">{showAll ? 'Show Less Events' : `Show All ${violations.length} Events`}</button></div>}
          </div>
        )}
      </div>
    </div>
  )
}
