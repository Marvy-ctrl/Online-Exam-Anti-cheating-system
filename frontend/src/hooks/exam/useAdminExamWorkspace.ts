import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/src/lib/api'
import type { AdminExam, EnrolledStudent } from '@/src/types/admin-exam'

interface UseAdminExamWorkspaceOptions {
  examUid: string
  institutionUid: string
}

export function useAdminExamWorkspace({
  examUid,
  institutionUid,
}: UseAdminExamWorkspaceOptions) {
  const router = useRouter()
  const [exam, setExam] = useState<AdminExam | null>(null)
  const [students, setStudents] = useState<EnrolledStudent[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [examResponse, studentsResponse] = await Promise.all([
        apiFetch(`/exam/${examUid}`),
        apiFetch(`/exam/${examUid}/students`),
      ])
      if (!examResponse.ok) throw new Error('Exam not found')
      setExam(await examResponse.json())
      if (studentsResponse.ok) setStudents(await studentsResponse.json())
    } catch {
      router.push(`/dashboard/institutions/${institutionUid}`)
    } finally {
      setLoading(false)
    }
  }, [examUid, institutionUid, router])

  useEffect(() => {
    if (examUid) void refresh()
  }, [examUid, refresh])

  const deleteExam = useCallback(async () => {
    if (
      !window.confirm(
        'Are you sure you want to permanently delete this exam and all its enrollments?',
      )
    ) {
      return
    }
    try {
      const response = await apiFetch(`/exam/delete_exam/${examUid}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        router.push(`/dashboard/institutions/${institutionUid}`)
        return
      }
      const result = await response.json()
      window.alert(`Error: ${result.detail || 'Failed to delete exam'}`)
    } catch {
      window.alert('An error occurred while deleting the exam.')
    }
  }, [examUid, institutionUid, router])

  return { deleteExam, exam, loading, refresh, students }
}
