import { Activity, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import type { LiveExamEvent } from '@/src/types/admin-exam'

interface LiveActivityFeedProps {
  events: LiveExamEvent[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LiveActivityFeed({
  events,
  open,
  onOpenChange,
}: LiveActivityFeedProps) {
  if (!open) {
    return (
      <button
        onClick={() => onOpenChange(true)}
        aria-label="Open live activity feed"
        className="fixed bottom-6 right-6 w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform z-40"
      >
        <Activity size={20} className="text-green-400" />
        {events.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {events.length}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 max-h-[400px] bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden z-40 animate-in slide-in-from-right duration-300">
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest">
          Live Activity Feed
        </span>
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Close live activity feed"
          className="hover:text-slate-400 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {events.length === 0 ? (
          <div className="py-10 text-center">
            <ShieldCheck size={24} className="text-slate-300 mx-auto mb-2" />
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
              No recent activity
            </p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="p-3 bg-white border border-slate-200 rounded-xl animate-in fade-in slide-in-from-top-1 duration-300"
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-900 truncate max-w-[140px]">
                  {event.student_name}
                </span>
                <span className="text-[8px] font-mono text-slate-400">
                  {new Date(event.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldAlert size={10} className="text-red-500" />
                <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">
                  {event.violation_type.replace(/_/g, ' ')}
                </span>
              </div>
              {event.message && (
                <p className="text-[9px] text-slate-500 italic leading-tight">
                  {event.message}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
