import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, BookOpen, CheckCircle2, Clock3, FileText, ShieldAlert, Users } from 'lucide-react'
import type { InstitutionAnalytics } from '@/src/types/institution-workspace'

interface Props {
  analytics: InstitutionAnalytics | null
  loading: boolean
  onRetry: () => void
}

export function InstitutionAnalyticsPanel({ analytics, loading, onRetry }: Props) {
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <p>Gathering institution insights...</p>
    </div>
  )
  if (!analytics) return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <BarChart3 size={32} className="text-slate-300 mb-2" />
      <p className="text-slate-500 font-medium">Failed to load analytics</p>
      <button onClick={onRetry} className="mt-2 text-sm text-blue-600 hover:underline">Try again</button>
    </div>
  )

  const cards = [
    { label: 'Total Exams', value: analytics.overview.total_exams, icon: FileText },
    { label: 'Students', value: analytics.overview.total_students, icon: Users },
    { label: 'Violations', value: analytics.overview.total_violations, icon: ShieldAlert },
    { label: 'Subjects', value: analytics.overview.total_subjects, icon: BookOpen },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
            <div className="flex items-center gap-3 text-slate-500 mb-2"><Icon size={16} /><span className="text-xs font-bold uppercase tracking-wider">{label}</span></div>
            <div className="text-3xl font-black text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 border border-slate-100 rounded-2xl">
          <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2"><ShieldAlert size={16} className="text-red-500" />Violation Distribution</h3>
          {analytics.violation_distribution.length > 0 ? (
            <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.violation_distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="violation_type" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <div className="h-64 flex items-center justify-center text-slate-400 text-sm italic">No violations recorded yet.</div>}
        </div>

        <div className="bg-white p-6 border border-slate-100 rounded-2xl">
          <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2"><Clock3 size={16} className="text-blue-500" />Exam Status</h3>
          <div className="flex items-center gap-8">
            <div className="h-48 w-48"><ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={analytics.exam_status_distribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="status">
                {analytics.exam_status_distribution.map((entry, index) => <Cell key={`${entry.status}-${index}`} fill={entry.status === 'Active' ? '#22c55e' : entry.status === 'Upcoming' ? '#f59e0b' : '#64748b'} />)}
              </Pie></PieChart>
            </ResponsiveContainer></div>
            <div className="flex-1 space-y-4">
              {analytics.exam_status_distribution.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${item.status === 'Active' ? 'bg-green-500' : item.status === 'Upcoming' ? 'bg-amber-500' : 'bg-slate-400'}`} /><span className="text-sm text-slate-600 font-medium">{item.status}</span></div>
                  <span className="text-sm font-bold text-slate-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 border border-slate-100 rounded-2xl">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><CheckCircle2 size={16} className="text-blue-500" />Top Alerted Students</h3>
        {analytics.top_violators.length > 0 ? <div className="divide-y divide-slate-50">
          {analytics.top_violators.map((violator, index) => (
            <div key={`${violator.name}-${index}`} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">{index + 1}</div><span className="text-sm font-medium text-slate-700">{violator.name}</span></div>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{violator.violation_count} Violations</span>
            </div>
          ))}
        </div> : <p className="text-slate-400 text-sm italic">All students are currently in good standing.</p>}
      </div>
    </div>
  )
}
