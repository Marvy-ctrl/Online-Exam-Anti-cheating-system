'use client'

import { useState } from 'react'
import { Clock, EyeOff, Fingerprint, Users } from 'lucide-react'
import type { AuditSnapshot } from '@/src/types/session-audit'
import { getViolationConfig } from './violation-config'

export function EvidenceSnapshots({ snapshots }: { snapshots: AuditSnapshot[] }) {
  const [showAll, setShowAll] = useState(false)
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 sm:px-7 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0"><EyeOff size={14} className="text-slate-400 flex-shrink-0" /><div className="min-w-0"><h3 className="text-sm font-bold text-slate-900">Evidence Snapshots</h3><p className="text-[10px] text-slate-400">Identity verification history</p></div></div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{snapshots.length} Captures</span>
      </div>
      <div className="p-4 sm:p-7">
        {snapshots.length === 0 ? <div className="text-center py-10 text-slate-400 text-sm italic">No snapshots captured during this session.</div> : <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {(showAll ? snapshots : snapshots.slice(0, 12)).map((snapshot, index) => <div key={`${snapshot.time}-${index}`} className="group relative">
              <div className="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                {/* Evidence URLs may require browser-held authentication cookies. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={snapshot.url} alt={`Capture ${index + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">{!snapshot.face_matches && <div className="bg-red-500 text-white p-1 rounded-md" title="Face Mismatch"><Fingerprint size={10} /></div>}{snapshot.multiple_faces && <div className="bg-orange-500 text-white p-1 rounded-md" title="Multiple Faces"><Users size={10} /></div>}</div>
                {snapshot.occurrence_count && snapshot.occurrence_count > 1 && <div className="absolute top-1.5 left-1.5 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">×{snapshot.occurrence_count}</div>}
              </div>
              <div className="mt-2.5"><div className="flex items-center gap-1.5 mb-1.5"><div className={`w-1.5 h-1.5 rounded-full ${snapshot.violation_type ? 'bg-red-500' : 'bg-green-500'}`} /><span className={`text-[10px] font-bold ${snapshot.violation_type ? 'text-red-600' : 'text-slate-600'}`}>{snapshot.violation_type ? getViolationConfig(snapshot.violation_type).label : 'Clean Snapshot'}</span></div><div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-medium"><Clock size={10} className="text-slate-300" /><span>{new Date(snapshot.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{snapshot.occurrence_count && snapshot.occurrence_count > 1 && snapshot.last_seen_at && ` - ${new Date(snapshot.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span></div></div>
            </div>)}
          </div>
          {snapshots.length > 8 && <div className="mt-6 flex justify-center"><button onClick={() => setShowAll((current) => !current)} className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors duration-150">{showAll ? 'Show Less Captures' : `Show All ${snapshots.length} Captures`}</button></div>}
        </div>}
      </div>
    </div>
  )
}
