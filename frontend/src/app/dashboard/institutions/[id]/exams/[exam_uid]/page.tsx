'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import QuestionManager from '@/src/components/dashboard/QuestionManager'
import { EnrolledStudentsPanel } from '@/src/components/dashboard/exam-detail/EnrolledStudentsPanel'
import { ExamOverviewPanel } from '@/src/components/dashboard/exam-detail/ExamOverviewPanel'
import { ExamResultsPanel } from '@/src/components/dashboard/exam-detail/ExamResultsPanel'
import { ExamSettingsPanel } from '@/src/components/dashboard/exam-detail/ExamSettingsPanel'
import { ExamWorkspaceHeader } from '@/src/components/dashboard/exam-detail/ExamWorkspaceHeader'
import { ExamWorkspaceTabs } from '@/src/components/dashboard/exam-detail/ExamWorkspaceTabs'
import { LiveActivityFeed } from '@/src/components/dashboard/exam-detail/LiveActivityFeed'
import { useAdminExamWorkspace } from '@/src/hooks/exam/useAdminExamWorkspace'
import { useExaminerMonitor } from '@/src/hooks/exam/useExaminerMonitor'
import { getExamStatus } from '@/src/lib/admin-exam'
import type { ExamWorkspaceTab } from '@/src/types/admin-exam'

export default function ExamDetailWorkspace() {
  const { id: institutionUid, exam_uid: examUid } = useParams<{
    id: string
    exam_uid: string
  }>()
  const [activeTab, setActiveTab] = useState<ExamWorkspaceTab>('overview')
  const workspace = useAdminExamWorkspace({ examUid, institutionUid })
  const monitor = useExaminerMonitor({
    enabled: workspace.exam
      ? getExamStatus(workspace.exam).label === 'Active'
      : false,
    examUid,
    students: workspace.students,
  })

  if (workspace.loading || !workspace.exam) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-400 min-h-[50vh]">
        Loading Exam Details...
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      <ExamWorkspaceHeader
        exam={workspace.exam}
        institutionUid={institutionUid}
        monitoringConnected={monitor.connected}
        onDelete={workspace.deleteExam}
      />
      <ExamWorkspaceTabs activeTab={activeTab} onChange={setActiveTab} />

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-8 min-h-[400px]">
        {activeTab === 'overview' && (
          <ExamOverviewPanel
            exam={workspace.exam}
            students={workspace.students}
            onRefresh={workspace.refresh}
          />
        )}
        {activeTab === 'enrolled' && (
          <EnrolledStudentsPanel
            examUid={examUid}
            students={workspace.students}
            onRefresh={workspace.refresh}
          />
        )}
        {activeTab === 'questions' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <QuestionManager examUid={examUid} />
          </div>
        )}
        {activeTab === 'results' && (
          <ExamResultsPanel examUid={examUid} institutionUid={institutionUid} />
        )}
        {activeTab === 'settings' && (
          <ExamSettingsPanel exam={workspace.exam} onRefresh={workspace.refresh} />
        )}
      </div>

      {monitor.connected && (
        <LiveActivityFeed
          events={monitor.events}
          open={monitor.feedOpen}
          onOpenChange={monitor.setFeedOpen}
        />
      )}
    </div>
  )
}
