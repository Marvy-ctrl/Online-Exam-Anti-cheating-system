'use client'

import Link from 'next/link'
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react'
import { useExamResults } from '@/src/hooks/exam/useExamResults'

interface ExamResultsPanelProps {
  examUid: string
  institutionUid: string
}

export function ExamResultsPanel({
  examUid,
  institutionUid,
}: ExamResultsPanelProps) {
  const results = useExamResults(examUid)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Exam Results & Autograde</h2>
          <p className="text-sm text-slate-500">
            View student performance and adjust marks if necessary.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {results.selectedSessionUids.size > 0 && (
            <button
              onClick={results.openBulkRelease}
              disabled={results.releasing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              Release result to students ({results.selectedSessionUids.size})
            </button>
          )}
          <button
            onClick={() => void results.fetchResults()}
            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
            title="Refresh Results"
          >
            <Calendar size={18} className={results.loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {results.loading ? (
        <div className="py-20 text-center text-slate-400">Loading results...</div>
      ) : results.results.length === 0 ? (
        <div className="py-20 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No submissions yet. Results will appear here once students submit their exams.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[760px] w-full table-fixed sm:table-auto text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="hidden sm:table-cell py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      results.selectedSessionUids.size === results.results.length &&
                      results.results.length > 0
                    }
                    onChange={results.toggleAllSessions}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="w-[24%] sm:w-auto py-3 px-2 sm:px-4">Student</th>
                <th className="w-[14%] sm:w-auto py-3 px-2 sm:px-4">Score</th>
                <th className="w-[21%] sm:w-auto py-3 px-2 sm:px-4">
                  <span className="sm:hidden">Alerts</span>
                  <span className="hidden sm:inline">Violations</span>
                </th>
                <th className="w-[17%] sm:w-auto py-3 px-2 sm:px-4">Status</th>
                <th className="w-[24%] sm:w-auto py-3 px-2 sm:px-4 text-center sm:text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {results.results.map((result) => (
                <tr
                  key={result.session_uid}
                  className="hover:bg-slate-50/50 transition-colors group align-top"
                >
                  <td className="hidden sm:table-cell py-3 px-4">
                    <input
                      type="checkbox"
                      checked={results.selectedSessionUids.has(result.session_uid)}
                      onChange={() => results.toggleSession(result.session_uid)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-3 px-2 sm:px-4">
                    <Link
                      href={`/dashboard/institutions/${institutionUid}/exams/${examUid}/audit/${result.session_uid}`}
                      className="text-left group/name block"
                    >
                      <div className="truncate text-xs sm:text-sm font-medium text-slate-900 group-hover/name:text-blue-600 transition-colors flex items-center gap-1.5">
                        {result.student_name}
                        <ExternalLink
                          size={12}
                          className="opacity-0 group-hover/name:opacity-100 transition-opacity"
                        />
                      </div>
                      <div className="hidden sm:block text-xs text-slate-400 font-mono">
                        {result.student_id}
                      </div>
                    </Link>
                  </td>
                  <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                    {result.score !== null
                      ? `${result.score} / ${result.total_marks || 0}`
                      : '--'}
                  </td>
                  <td className="py-3 px-2 sm:px-4">
                    {result.violation_count > 0 ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[10px] sm:text-xs font-bold">
                          <AlertCircle size={10} /> {result.violation_count}
                          <span className="hidden sm:inline"> Violations</span>
                        </span>
                        {result.violation_summary &&
                          result.violation_summary !== 'None' && (
                            <p className="hidden sm:block text-[10px] text-slate-500 font-medium leading-tight">
                              {result.violation_summary}
                            </p>
                          )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[10px] sm:text-xs">
                        <span className="sm:hidden">None</span>
                        <span className="hidden sm:inline">No violations</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 sm:px-4">
                    <span
                      className={`inline-block max-w-full truncate px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase ${
                        result.status === 'Submitted'
                          ? 'bg-green-50 text-green-600 border border-green-100'
                          : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}
                    >
                      <span className="sm:hidden">
                        {result.status === 'Submitted' ? 'Done' : result.status}
                      </span>
                      <span className="hidden sm:inline">{result.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-2 sm:px-4 text-center sm:text-right">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => results.openScoreEditor(result)}
                        className="px-1.5 sm:px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-slate-50 hover:border-blue-300 transition-all"
                      >
                        Edit Score
                      </button>
                      <button
                        onClick={() =>
                          results.openSingleRelease(
                            result.session_uid,
                            result.student_name,
                          )
                        }
                        className="px-1.5 sm:px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] sm:text-xs hover:bg-slate-50 hover:border-blue-300 font-bold transition-all inline-flex items-center justify-center gap-1"
                      >
                        Send Result
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.scoreSession && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Adjust Student Score
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Manually update <strong>{results.scoreSession.student_name}</strong>’s
              results.
            </p>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  New Score (Marks)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={results.newScore}
                  onChange={(event) => results.setNewScore(event.target.value)}
                  placeholder="Enter raw score"
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Reason for Adjustment
                </label>
                <textarea
                  value={results.adjustmentReason}
                  onChange={(event) =>
                    results.setAdjustmentReason(event.target.value)
                  }
                  placeholder="e.g. Penalized for tab switching violations"
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={results.closeScoreEditor}
                className="flex-1 py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void results.updateScore()}
                disabled={results.updatingScore}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {results.updatingScore ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {results.releaseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Release Exam Results
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {results.releaseMode === 'bulk'
                ? `You are about to release and email the exam results to the ${results.selectedSessionUids.size} selected student(s).`
                : `You are about to release and email the exam result to ${results.releaseTarget?.studentName}.`}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={results.closeReleaseModal}
                className="flex-1 py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void results.confirmRelease()}
                disabled={results.releasing}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {results.releasing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Releasing...
                  </>
                ) : (
                  'Release Results'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {results.toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-semibold animate-in slide-in-from-bottom-4 duration-300 ${
            results.toast.type === 'success'
              ? 'bg-white border-green-200 text-slate-800'
              : 'bg-white border-red-200 text-slate-800'
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              results.toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            {results.toast.type === 'success' ? (
              <CheckCircle size={14} className="text-green-600" />
            ) : (
              <AlertCircle size={14} className="text-red-600" />
            )}
          </div>
          <span>{results.toast.message}</span>
          <button
            onClick={results.dismissToast}
            className="ml-2 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
