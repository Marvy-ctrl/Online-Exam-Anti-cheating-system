"use client"
import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/src/lib/api'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock,
  ShieldCheck,
  ChevronRight,
  EyeOff,
  Users,
  Shuffle,
  Monitor,
  Fingerprint,
  TrendingUp,
  CheckCircle2,
  Mail,
  Hash,
  User,
  Send,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

interface Snapshot {
  url: string
  face_matches: boolean
  multiple_faces: boolean
  time: string
  violation_type?: string
  occurrence_count?: number
  last_seen_at?: string
}

interface Violation {
  type: string
  time: string
  metadata?: { count?: number }
}

interface AuditDetails {
  session_uid: string
  student_name: string
  student_id: string
  email: string
  start_time: string
  end_time: string | null
  status: string
  score: number | null
  total_marks: number
  score_percentage: number | null
  adjustment_reason: string | null
  violations: Violation[]
  snapshots: Snapshot[]
}

type Severity = 'critical' | 'high' | 'medium'

interface ViolationConfig {
  label: string
  icon: React.ReactNode
  textColor: string
  bgColor: string
  borderColor: string
  badgeBg: string
  badgeText: string
  severity: Severity
}

const VIOLATION_CONFIG: Record<string, ViolationConfig> = {
  'no_face': {
    label: 'No Face Detected',
    icon: <EyeOff size={14} />,
    textColor: 'text-orange-600',
    bgColor: 'bg-white',
    borderColor: 'border-red-200',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    severity: 'high',
  },
  'multiple_faces': {
    label: 'Multiple Faces',
    icon: <Users size={14} />,
    textColor: 'text-red-600',
    bgColor: 'bg-white',
    borderColor: 'border-red-200',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    severity: 'critical',
  },
  'face_mismatch': {
    label: 'Face Mismatch',
    icon: <Fingerprint size={14} />,
    textColor: 'text-rose-600',
    bgColor: 'bg-white',
    borderColor: 'border-red-200',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    severity: 'critical',
  },
  'tab_switch': {
    label: 'Tab Switching',
    icon: <Shuffle size={14} />,
    textColor: 'text-yellow-700',
    bgColor: 'bg-white',
    borderColor: 'border-red-200',
    badgeBg: 'bg-yellow-100',
    badgeText: 'text-yellow-800',
    severity: 'medium',
  },
  'focus_loss': {
    label: 'Focus Lost',
    icon: <Monitor size={14} />,
    textColor: 'text-amber-700',
    bgColor: 'bg-white',
    borderColor: 'border-red-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    severity: 'medium',
  },
}

function getConfig(type: string): ViolationConfig {
  return VIOLATION_CONFIG[type] ?? {
    label: type,
    icon: <AlertTriangle size={14} />,
    textColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    severity: 'high',
  }
}

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
}

export default function SessionAuditPage() {
  const params = useParams()
  const router = useRouter()
  const { id, exam_uid, session_uid } = params as { id: string; exam_uid: string; session_uid: string }

  const [loading, setLoading] = useState(true)
  const [auditDetails, setAuditDetails] = useState<AuditDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [showAllSnapshots, setShowAllSnapshots] = useState(false)
  const [showAllViolations, setShowAllViolations] = useState(false)


  useEffect(() => {
    if (!session_uid) return
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFetch(`/exam_session/session/${session_uid}/details`)
        if (res.ok) {
          setAuditDetails(await res.json())
        } else {
          const err = await res.json().catch(() => ({}))
          setError(err.detail || `Server error (${res.status})`)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Network error')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [session_uid])

  const violationBreakdown = useMemo(() => {
    if (!auditDetails) return []
    const counts: Record<string, number> = {}
    for (const v of auditDetails.violations) {
      counts[v.type] = (counts[v.type] ?? 0) + 1
    }
    return Object.entries(counts).map(([type, count]) => ({ type, count, config: getConfig(type) }))
  }, [auditDetails])

  const duration = useMemo(() => {
    if (!auditDetails?.start_time) return '--'
    const end = auditDetails.end_time ? new Date(auditDetails.end_time) : new Date()
    const diff = Math.floor((end.getTime() - new Date(auditDetails.start_time).getTime()) / 1000)
    return `${Math.floor(diff / 60)}m ${diff % 60}s`
  }, [auditDetails])

  const isSubmitted = auditDetails?.status?.toLowerCase() === 'submitted'
  const initials = auditDetails?.student_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'

  const handleSendResult = async () => {
    if (!session_uid || sendingEmail) return
    setSendingEmail(true)
    try {
      const res = await apiFetch(`/exam_session/session/${session_uid}/send-result`, {
        method: 'POST'
      })
      if (res.ok) {
        setEmailSent(true)
        setTimeout(() => setEmailSent(false), 5000)
      } else {
        const err = await res.json()
        console.error("❌ Send result error:", err)
        alert(err.detail ? JSON.stringify(err.detail) : "Failed to send email")
      }
    } catch (e) {
      alert("Network error while sending email")
    } finally {
      setSendingEmail(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-semibold text-sm">Loading audit record…</p>
      </div>
    )
  }

  if (error || !auditDetails) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-md text-center">
          <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Could Not Load Record</h2>
          <p className="text-slate-500 text-sm mb-7">{error || 'Session data unavailable'}</p>
          <button
            onClick={() => router.back()}
            className="w-full py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <ArrowLeft size={16} /> Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top Nav ───────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-h-[56px]">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.back()}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900 flex-shrink-0"
              >
                <ArrowLeft size={17} />
              </button>
              <div className="hidden sm:block h-4 w-px bg-slate-200" />
              <nav className="flex flex-wrap items-center gap-1 text-[10px] sm:text-xs font-medium text-slate-400 min-w-0">
                <Link href={`/dashboard/institutions/${id}`} className="hover:text-blue-600 transition-colors truncate">Institution</Link>
                <ChevronRight size={11} />
                <Link href={`/dashboard/institutions/${id}/exams/${exam_uid}`} className="hover:text-blue-600 transition-colors truncate">Exam</Link>
                <ChevronRight size={11} />
                <span className="text-slate-700 font-semibold truncate">Student Log</span>
              </nav>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              {isSubmitted && (
                <button
                  onClick={handleSendResult}
                  disabled={sendingEmail}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all ${
                    emailSent 
                    ? 'bg-green-500 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                  }`}
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Sending...
                    </>
                  ) : emailSent ? (
                    <>
                      Result Sent
                    </>
                  ) : (
                    <>
                      Send Result to Student
                    </>
                  )}
                </button>
              )}
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${isSubmitted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {auditDetails.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 sm:px-6 sm:py-8 space-y-4 sm:space-y-6">

        {/* ── Candidate Banner ──────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Candidate</p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight break-words">{auditDetails.student_name}</h1>
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-1 sm:gap-4 mt-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500">
                    <Hash size={11} className="text-slate-400" />{auditDetails.student_id}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 break-all">
                    <Mail size={11} className="text-slate-400 flex-shrink-0" />{auditDetails.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 gap-3 w-full sm:w-auto sm:grid-cols-3 sm:flex sm:items-stretch sm:gap-3">
              {[
                {
                  label: 'Score',
                  value: auditDetails.score !== null ? `${auditDetails.score} / ${auditDetails.total_marks || 0}` : '--',
                  sub: 'Final result',
                  icon: <TrendingUp size={13} className="text-blue-500" />,
                  accent: 'border-slate-200',
                },
                {
                  label: 'Violations',
                  value: `${auditDetails.violations.length}`,
                  sub: auditDetails.violations.length === 0 ? 'Clean session' : 'Events recorded',
                  icon: <AlertTriangle size={13} className={auditDetails.violations.length === 0 ? 'text-green-500' : 'text-red-500'} />,
                  accent: auditDetails.violations.length === 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
                },
                {
                  label: 'Duration',
                  value: duration,
                  sub: 'Session length',
                  icon: <Clock size={13} className="text-slate-400" />,
                  accent: 'border-slate-200',
                },
              ].map(s => (
                <div key={s.label} className={`border rounded-xl p-3 sm:p-4 bg-white ${s.accent}`}>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">
                    {s.icon} {s.label}
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-slate-900">{s.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left Column ───────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Timeline Card */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <Clock size={13} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session Timeline</span>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  {
                    label: 'Started',
                    time: new Date(auditDetails.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    date: new Date(auditDetails.start_time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
                    dot: 'bg-blue-500',
                  },
                  {
                    label: 'Ended',
                    time: auditDetails.end_time
                      ? new Date(auditDetails.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : 'In Progress',
                    date: auditDetails.end_time
                      ? new Date(auditDetails.end_time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                      : '--',
                    dot: auditDetails.end_time ? 'bg-green-500' : 'bg-amber-400 animate-pulse',
                  },
                  { label: 'Duration', time: duration, date: 'Total session length', dot: 'bg-slate-300' },
                ].map(row => (
                  <div key={row.label} className="px-5 py-4 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${row.dot}`} />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{row.label}</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{row.time}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{row.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Violation Breakdown */}
            {violationBreakdown.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                  <AlertTriangle size={13} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Violation Breakdown</span>
                </div>
                <div className="p-4 space-y-2">
                  {violationBreakdown.map(({ type, count, config }) => (
                    <div key={type} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${config.bgColor} ${config.borderColor}`}>
                      <span className={`flex items-center gap-2 text-xs font-semibold ${config.textColor}`}>
                        {config.icon} {config.label}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${config.badgeBg} ${config.badgeText}`}>
                        {count}×
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Adjustment Note */}
            {auditDetails.adjustment_reason && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider mb-1.5">Score Adjustment</p>
                <p className="text-sm text-amber-900 leading-relaxed">{auditDetails.adjustment_reason}</p>
              </div>
            )}

            {/* Clean Session */}
            {auditDetails.violations.length === 0 && (
              <div className="border border-slate-200 rounded-2xl p-6 text-center">
             
                <p className="font-bold text-black text-sm">Zero Violations</p>
                <p className="text-xs text-black mt-1">Full compliance</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

              <div className="px-7 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* <div className="p-1.5 bg-slate-100 rounded-lg">
                    <Activity size={14} className="text-slate-500" />
                  </div> */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Student Event Log</h3>
                    <p className="text-[10px] text-slate-400">Violation record</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${auditDetails.violations.length === 0 ? ' text-black' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  {auditDetails.violations.length} events
                </span>
              </div>

              <div className="p-4 sm:p-7">
                {auditDetails.violations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
                    <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-1">No violations Detected</h4>
                    <p className="text-sm text-slate-400 max-w-xs">
                      The candidate maintained full compliance throughout the examination session.
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Vertical guide line */}
                    <div className="absolute left-[14px] sm:left-[15px] top-5 bottom-5 w-px bg-slate-100" />

                    <div className="space-y-4">
                      {auditDetails.violations
                        .slice(0, showAllViolations ? undefined : 6)
                        .map((v, idx) => {
                          const cfg = getConfig(v.type)
                          const time = new Date(v.time)
                          return (
                            <div key={idx} className="relative flex gap-3 sm:gap-5 group">
                              {/* Dot */}
                              <div className={`relative z-10 w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 rounded-full border-2 ${cfg.borderColor} ${cfg.bgColor} flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform ${cfg.textColor}`}>
                                {cfg.icon}
                              </div>

                              {/* Card */}
                              <div className={`flex-1 border ${cfg.borderColor} ${cfg.bgColor} rounded-xl p-3 sm:p-4 transition-shadow`}>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span className={`text-sm font-bold ${cfg.textColor}`}>{cfg.label}</span>
                                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${SEVERITY_BADGE[cfg.severity]}`}>
                                        {cfg.severity}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                      Security violation logged.
                                    </p>
                                  </div>
                                  <div className="text-left sm:text-right flex-shrink-0">
                                    <p className={`font-mono text-xs sm:text-sm font-bold ${cfg.textColor}`}>
                                      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      {time.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                    <p className="text-[9px] text-slate-300 font-bold mt-1">{String(idx + 1).padStart(3, '0')}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>

                    {auditDetails.violations.length > 6 && (
                      <div className="mt-6 text-center border-t border-slate-100 pt-4">
                        <button
                          onClick={() => setShowAllViolations(!showAllViolations)}
                          className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all inline-flex items-center justify-center gap-1.5 "
                        >
                          {showAllViolations ? "Show Less Events" : `Show All ${auditDetails.violations.length} Events`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Evidence Snapshots ────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 sm:px-7 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <EyeOff size={14} className="text-slate-400 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Evidence Snapshots</h3>
                <p className="text-[10px] text-slate-400">Identity verification history</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
              {auditDetails.snapshots.length} Captures
            </span>
          </div>

          <div className="p-4 sm:p-7">
            {auditDetails.snapshots.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm italic">
                No snapshots captured during this session.
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                  {(showAllSnapshots ? auditDetails.snapshots : auditDetails.snapshots.slice(0, 12)).map((s, idx) => (
                    <div key={idx} className="group relative">
                      <div className="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        <img 
                          src={s.url} 
                          alt={`Capture ${idx + 1}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Status Badges */}
                        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                          {!s.face_matches && (
                            <div className="bg-red-500 text-white p-1 rounded-md " title="Face Mismatch">
                              <Fingerprint size={10} />
                            </div>
                          )}
                          {s.multiple_faces && (
                            <div className="bg-orange-500 text-white p-1 rounded-md " title="Multiple Faces">
                              <Users size={10} />
                            </div>
                          )}
                        </div>
                        {/* Occurrence count badge */}
                        {s.occurrence_count && s.occurrence_count > 1 && (
                          <div className="absolute top-1.5 left-1.5 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                            ×{s.occurrence_count}
                          </div>
                        )}
                      </div>
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${s.violation_type ? 'bg-red-500' : 'bg-green-500'}`} />
                            <span className={`text-[10px] font-bold ${s.violation_type ? 'text-red-600' : 'text-slate-600'}`}>
                              {s.violation_type ? getConfig(s.violation_type).label : 'Clean Snapshot'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-medium">
                          <Clock size={10} className="text-slate-300" />
                          <span>
                            {new Date(s.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {s.occurrence_count && s.occurrence_count > 1 && s.last_seen_at && ` - ${new Date(s.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {auditDetails.snapshots.length > 8 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => setShowAllSnapshots(!showAllSnapshots)}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors duration-150"
                    >
                      {showAllSnapshots ? 'Show Less Captures' : `Show All ${auditDetails.snapshots.length} Captures`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
