import { AlertTriangle, Loader2, ShieldAlert, X } from 'lucide-react'

export function ExamLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <Loader2 size={36} className="animate-spin text-blue-400 mx-auto mb-3" />
        <p className="text-slate-400">Loading exam...</p>
      </div>
    </div>
  )
}

export function ExamLoadError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md text-center">
        <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
        <p className="text-red-300 font-semibold mb-2">Cannot load exam</p>
        <p className="text-slate-400 text-sm">{message}</p>
      </div>
    </div>
  )
}

export function ExamSubmitted({ submittedAt }: { submittedAt: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-10 text-center shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">Exam Submitted!</h1>
        <p className="text-slate-400 mb-6">Your answers have been securely recorded.</p>
        {submittedAt && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-sm">
            <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">
              Submitted at
            </div>
            <div className="text-white font-semibold">
              {new Date(submittedAt).toLocaleString()}
            </div>
          </div>
        )}
        <p className="text-slate-400 text-sm">
          You may close this window. Good luck with your results!
        </p>
      </div>
    </div>
  )
}

interface ViolationBannerProps {
  message: string
  onDismiss: () => void
}

export function ViolationBanner({ message, onDismiss }: ViolationBannerProps) {
  if (!message) return null
  return (
    <div className="bg-red-600/90 text-white text-sm font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 z-50">
      <ShieldAlert size={16} /> {message}
      <button onClick={onDismiss} className="ml-2" aria-label="Dismiss warning">
        <X size={14} />
      </button>
    </div>
  )
}

interface SubmitModalProps {
  answeredCount: number
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  totalCount: number
}

export function SubmitModal({
  answeredCount,
  isSubmitting,
  onCancel,
  onConfirm,
  open,
  totalCount,
}: SubmitModalProps) {
  if (!open) return null
  const unansweredCount = totalCount - answeredCount

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-2">Submit Your Exam?</h2>
          <p className="text-slate-400 text-sm">This action cannot be undone.</p>
        </div>
        {unansweredCount > 0 && (
          <div className="bg-amber-500/1 p-4 mb-6 text-sm text-amber-300 text-center">
            You have <strong>{unansweredCount}</strong> unanswered question
            {unansweredCount !== 1 ? 's' : ''}. Unanswered questions will receive no marks.
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors text-sm"
          >
            Continue Exam
          </button>
          <button
            id="confirm-submit-btn"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Yes, Submit
          </button>
        </div>
      </div>
    </div>
  )
}
