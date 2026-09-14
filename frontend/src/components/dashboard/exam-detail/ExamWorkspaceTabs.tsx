import { CheckCircle, Cog, FileText, HelpCircle, Users } from 'lucide-react'
import type { ExamWorkspaceTab } from '@/src/types/admin-exam'

interface ExamWorkspaceTabsProps {
  activeTab: ExamWorkspaceTab
  onChange: (tab: ExamWorkspaceTab) => void
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'enrolled', label: 'Enrolled Students', icon: Users },
  { id: 'questions', label: 'Questions', icon: HelpCircle },
  { id: 'results', label: 'Results & Grading', icon: CheckCircle },
  { id: 'settings', label: 'Configuration', icon: Cog },
] as const

export function ExamWorkspaceTabs({
  activeTab,
  onChange,
}: ExamWorkspaceTabsProps) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto border-b border-slate-200 mb-6 sm:mb-8 px-2 [-webkit-overflow-scrolling:touch]">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-label={label}
          title={label}
          className={`shrink-0 whitespace-nowrap pb-4 flex items-center gap-2 font-medium text-xs sm:text-sm transition-colors relative ${
            activeTab === id
              ? 'text-blue-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Icon size={16} /> {label}
          {activeTab === id && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
      ))}
    </div>
  )
}
