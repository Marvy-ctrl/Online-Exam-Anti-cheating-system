'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { AuditNavigation } from '@/src/components/dashboard/session-audit/AuditNavigation'
import { CandidateSummary } from '@/src/components/dashboard/session-audit/CandidateSummary'
import { EvidenceSnapshots } from '@/src/components/dashboard/session-audit/EvidenceSnapshots'
import { SessionSummarySidebar } from '@/src/components/dashboard/session-audit/SessionSummarySidebar'
import { ViolationEventLog } from '@/src/components/dashboard/session-audit/ViolationEventLog'
import { useSessionAudit } from '@/src/hooks/useSessionAudit'

export default function SessionAuditPage() {
  const { id, exam_uid: examUid, session_uid: sessionUid } = useParams<{
    id: string
    exam_uid: string
    session_uid: string
  }>()
  const router = useRouter()
  const audit = useSessionAudit(sessionUid)

  const duration = useMemo(() => {
    if (!audit.details?.start_time) return '--'
    const end = audit.details.end_time ? new Date(audit.details.end_time) : new Date()
    const seconds = Math.floor((end.getTime() - new Date(audit.details.start_time).getTime()) / 1000)
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }, [audit.details])

  if (audit.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-semibold text-sm">Loading audit record…</p>
      </div>
    )
  }

  if (audit.error || !audit.details) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-md text-center">
          <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto mb-5"><AlertTriangle size={28} className="text-red-500" /></div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Could Not Load Record</h2>
          <p className="text-slate-500 text-sm mb-7">{audit.error || 'Session data unavailable'}</p>
          <button onClick={() => router.back()} className="w-full py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"><ArrowLeft size={16} /> Go Back</button>
        </div>
      </div>
    )
  }

  const isSubmitted = audit.details.status.toLowerCase() === 'submitted'

  return (
    <div className="min-h-screen bg-slate-50">
      <AuditNavigation
        emailSent={audit.emailSent}
        examUid={examUid}
        institutionUid={id}
        isSubmitted={isSubmitted}
        onBack={() => router.back()}
        onSendResult={audit.sendResult}
        sendingEmail={audit.sendingEmail}
        status={audit.details.status}
      />
      <div className="max-w-6xl mx-auto px-4 py-5 sm:px-6 sm:py-8 space-y-4 sm:space-y-6">
        <CandidateSummary details={audit.details} duration={duration} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SessionSummarySidebar details={audit.details} duration={duration} />
          <div className="lg:col-span-2"><ViolationEventLog violations={audit.details.violations} /></div>
        </div>
        <EvidenceSnapshots snapshots={audit.details.snapshots} />
      </div>
    </div>
  )
}
