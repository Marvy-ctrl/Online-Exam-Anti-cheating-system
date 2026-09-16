import Link from 'next/link'
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react'

interface Props {
  emailSent: boolean
  examUid: string
  institutionUid: string
  isSubmitted: boolean
  onBack: () => void
  onSendResult: () => void
  sendingEmail: boolean
  status: string
}

export function AuditNavigation(props: Props) {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-h-[56px]">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={props.onBack} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900 flex-shrink-0" aria-label="Go back"><ArrowLeft size={17} /></button>
            <div className="hidden sm:block h-4 w-px bg-slate-200" />
            <nav className="flex flex-wrap items-center gap-1 text-[10px] sm:text-xs font-medium text-slate-400 min-w-0">
              <Link href={`/dashboard/institutions/${props.institutionUid}`} className="hover:text-blue-600 transition-colors truncate">Institution</Link>
              <ChevronRight size={11} />
              <Link href={`/dashboard/institutions/${props.institutionUid}/exams/${props.examUid}`} className="hover:text-blue-600 transition-colors truncate">Exam</Link>
              <ChevronRight size={11} />
              <span className="text-slate-700 font-semibold truncate">Student Log</span>
            </nav>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            {props.isSubmitted && (
              <button onClick={props.onSendResult} disabled={props.sendingEmail} className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all ${props.emailSent ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'}`}>
                {props.sendingEmail ? <><Loader2 size={13} className="animate-spin" />Sending...</> : props.emailSent ? 'Result Sent' : 'Send Result to Student'}
              </button>
            )}
            <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${props.isSubmitted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{props.status}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
