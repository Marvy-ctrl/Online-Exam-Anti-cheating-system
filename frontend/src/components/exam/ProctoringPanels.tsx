import type { RefObject } from 'react'
import { Loader2 } from 'lucide-react'
import type { ExamData, FaceStatus } from '@/src/types/exam'

interface MobileMonitorStripProps {
  answeredCount: number
  canvasRef: RefObject<HTMLCanvasElement | null>
  exam: ExamData
  faceStatus: FaceStatus
  totalCount: number
  videoRef: RefObject<HTMLVideoElement | null>
}

export function MobileMonitorStrip({
  answeredCount,
  canvasRef,
  exam,
  faceStatus,
  totalCount,
  videoRef,
}: MobileMonitorStripProps) {
  return (
    <div className="md:hidden shrink-0 bg-slate-900 flex items-center gap-3 px-3 py-2 border-b border-slate-700">
      <div className="relative rounded-xl overflow-hidden bg-black w-20 h-14 shrink-0 ring-1 ring-slate-600">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        <span
          aria-label={`Face monitor ${faceStatus}`}
          className={`absolute right-1 top-1 h-2 w-2 rounded-full ${
            faceStatus === 'ok'
              ? 'bg-green-400'
              : faceStatus === 'warning'
                ? 'bg-amber-400'
                : 'bg-blue-400 animate-pulse'
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Live Monitoring Active
        </p>
        <p className="text-xs text-slate-300 font-medium truncate">
          {exam.student_first_name} {exam.student_last_name}
        </p>
        <p className="text-[10px] text-slate-500 font-mono truncate">{exam.student_id}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Progress</div>
        <div className="text-sm font-black text-white">
          {answeredCount}
          <span className="text-slate-400 font-normal">/{totalCount}</span>
        </div>
      </div>
    </div>
  )
}

interface ProctoringSidebarProps {
  answeredCount: number
  faceStatus: FaceStatus
  isSubmitting: boolean
  nextCheckIn: number
  onOpenSubmit: () => void
  totalCount: number
  videoRef: RefObject<HTMLVideoElement | null>
  websocketConnected: boolean
}

export function ProctoringSidebar({
  answeredCount,
  faceStatus,
  isSubmitting,
  nextCheckIn,
  onOpenSubmit,
  totalCount,
  videoRef,
  websocketConnected,
}: ProctoringSidebarProps) {
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0

  return (
    <aside className="hidden md:flex w-72 shrink-0 bg-slate-50 border-l border-slate-200 flex-col p-6 gap-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Live Monitoring
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span
              className={`h-2 w-2 rounded-full ${websocketConnected ? 'bg-green-500' : 'bg-amber-500'}`}
            />
            {websocketConnected ? 'Connected' : 'Connecting'}
          </div>
        </div>
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3] shadow-lg ring-1 ring-slate-200">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-x-2 bottom-2 flex justify-between text-[10px] text-white/80">
            <span className="rounded bg-black/50 px-2 py-1">Face: {faceStatus}</span>
            <span className="rounded bg-black/50 px-2 py-1">Next check: {nextCheckIn}s</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Progress
            </div>
            <div className="text-slate-900 font-black text-lg">
              {answeredCount}/{totalCount}
            </div>
          </div>
          <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
            {Math.round(progress)}%
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <button
        onClick={onOpenSubmit}
        disabled={isSubmitting}
        className="mt-auto w-full py-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 disabled:opacity-50"
      >
        {isSubmitting && <Loader2 size={18} className="animate-spin" />}
        {isSubmitting ? 'Finalizing...' : 'Submit Final Script'}
      </button>
    </aside>
  )
}
