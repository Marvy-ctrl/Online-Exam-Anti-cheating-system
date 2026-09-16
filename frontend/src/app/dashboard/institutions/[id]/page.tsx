'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CreateExamModal from '@/src/components/dashboard/CreateExamModal'
import CreateSubjectModal from '@/src/components/dashboard/CreateSubjectModal'
import { InstitutionAnalyticsPanel } from '@/src/components/dashboard/institution-workspace/InstitutionAnalyticsPanel'
import { InstitutionExamsPanel } from '@/src/components/dashboard/institution-workspace/InstitutionExamsPanel'
import { InstitutionStudentsPanel } from '@/src/components/dashboard/institution-workspace/InstitutionStudentsPanel'
import { InstitutionSubjectsPanel } from '@/src/components/dashboard/institution-workspace/InstitutionSubjectsPanel'
import { InstitutionWorkspaceHeader } from '@/src/components/dashboard/institution-workspace/InstitutionWorkspaceHeader'
import { InstitutionWorkspaceTabs } from '@/src/components/dashboard/institution-workspace/InstitutionWorkspaceTabs'
import { useInstitutionWorkspace } from '@/src/hooks/useInstitutionWorkspace'
import type { InstitutionWorkspaceTab } from '@/src/types/institution-workspace'

export default function InstitutionWorkspace() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<InstitutionWorkspaceTab>('exams')
  const [subjectModalOpen, setSubjectModalOpen] = useState(false)
  const [examModalOpen, setExamModalOpen] = useState(false)
  const workspace = useInstitutionWorkspace(id)
  const { loadAnalytics } = workspace

  useEffect(() => {
    if (activeTab === 'analytics') void loadAnalytics()
  }, [activeTab, loadAnalytics])

  if (workspace.loading || !workspace.institution) {
    return <div className="p-8 flex items-center justify-center text-slate-400 min-h-[50vh]">Loading Workspace...</div>
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-8">
      <InstitutionWorkspaceHeader
        institution={workspace.institution}
        onCreateExam={() => setExamModalOpen(true)}
        onCreateSubject={() => setSubjectModalOpen(true)}
        onDelete={workspace.deleteWorkspace}
      />
      <InstitutionWorkspaceTabs activeTab={activeTab} onChange={setActiveTab} />

      <div className="rounded-2xl border border-slate-200 p-4 sm:p-8 min-h-[400px]">
        {activeTab === 'exams' && <InstitutionExamsPanel exams={workspace.exams} institutionUid={id} />}
        {activeTab === 'students' && <InstitutionStudentsPanel students={workspace.students} onEdit={workspace.editStudent} />}
        {activeTab === 'subjects' && (
          <InstitutionSubjectsPanel institutionUid={id} subjects={workspace.subjects} onDelete={workspace.deleteSubject} onEdit={workspace.editSubject} />
        )}
        {activeTab === 'analytics' && (
          <InstitutionAnalyticsPanel analytics={workspace.analytics} loading={workspace.loadingAnalytics} onRetry={workspace.loadAnalytics} />
        )}
      </div>

      <CreateSubjectModal isOpen={subjectModalOpen} onClose={() => setSubjectModalOpen(false)} institutionUid={id} onSuccess={workspace.refresh} />
      <CreateExamModal isOpen={examModalOpen} onClose={() => setExamModalOpen(false)} institutionUid={id} subjects={workspace.subjects} onSuccess={workspace.refresh} />
    </div>
  )
}
