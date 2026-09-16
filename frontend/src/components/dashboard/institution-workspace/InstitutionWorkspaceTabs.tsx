import { BarChart3, BookOpen, FileText, Users } from 'lucide-react'
import type { InstitutionWorkspaceTab } from '@/src/types/institution-workspace'

const TABS = [
  { id: 'exams', label: 'Exams', icon: FileText },
  { id: 'students', label: 'Enrolled', icon: Users },
  { id: 'subjects', label: 'Subjects', icon: BookOpen },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const

interface Props {
  activeTab: InstitutionWorkspaceTab
  onChange: (tab: InstitutionWorkspaceTab) => void
}

export function InstitutionWorkspaceTabs({ activeTab, onChange }: Props) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto border-b border-slate-200 mb-6 sm:mb-8 px-2 [-webkit-overflow-scrolling:touch]">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onChange(id)} aria-label={label} title={label} className={`shrink-0 whitespace-nowrap pb-4 flex items-center gap-2 font-medium text-xs sm:text-sm transition-colors relative ${activeTab === id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>
          <Icon size={16} /> {label}
          {activeTab === id && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />}
        </button>
      ))}
    </div>
  )
}
