'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/src/lib/api'
import type {
  InstitutionAnalytics,
  InstitutionExam,
  InstitutionStudent,
  InstitutionSubject,
  InstitutionWorkspaceDetails,
} from '@/src/types/institution-workspace'

export function useInstitutionWorkspace(institutionUid: string) {
  const router = useRouter()
  const [institution, setInstitution] = useState<InstitutionWorkspaceDetails | null>(null)
  const [exams, setExams] = useState<InstitutionExam[]>([])
  const [subjects, setSubjects] = useState<InstitutionSubject[]>([])
  const [students, setStudents] = useState<InstitutionStudent[]>([])
  const [analytics, setAnalytics] = useState<InstitutionAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const refresh = useCallback(async () => {
    if (!institutionUid) return
    setLoading(true)
    try {
      const [institutionResponse, subjectResponse, examResponse, studentResponse] = await Promise.all([
        apiFetch(`/institutions/${institutionUid}`),
        apiFetch(`/exam/subjects?institution_uid=${institutionUid}`),
        apiFetch(`/exam/get_all_exams?institution_uid=${institutionUid}`),
        apiFetch(`/exam/students?institution_uid=${institutionUid}`),
      ])
      if (!institutionResponse.ok) throw new Error('Institution not found')
      setInstitution(await institutionResponse.json())
      if (subjectResponse.ok) setSubjects(await subjectResponse.json())
      if (examResponse.ok) setExams(await examResponse.json())
      if (studentResponse.ok) setStudents(await studentResponse.json())
    } catch (error) {
      console.error(error)
      router.push('/dashboard/institutions')
    } finally {
      setLoading(false)
    }
  }, [institutionUid, router])

  const loadAnalytics = useCallback(async () => {
    if (!institutionUid || analytics) return
    setLoadingAnalytics(true)
    try {
      const response = await apiFetch(`/analytics/institution/${institutionUid}`)
      if (response.ok) setAnalytics(await response.json())
    } catch (error) {
      console.error('Failed to fetch analytics', error)
    } finally {
      setLoadingAnalytics(false)
    }
  }, [analytics, institutionUid])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const deleteWorkspace = useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete this workspace? This action cannot be undone and will delete all associated subjects and exams.')) return
    try {
      const response = await apiFetch(`/institutions/${institutionUid}`, { method: 'DELETE' })
      if (response.ok) return router.push('/dashboard/institutions')
      const error = await response.json()
      alert(`Error: ${error.detail || 'Failed to delete'}`)
    } catch {
      alert('An error occurred while deleting the workspace')
    }
  }, [institutionUid, router])

  const editStudent = useCallback(async (student: InstitutionStudent) => {
    const firstName = window.prompt('Enter new first name:', student.first_name)
    if (firstName === null) return
    const lastName = window.prompt('Enter new last name:', student.last_name)
    if (lastName === null) return
    const email = window.prompt('Enter new email:', student.email)
    if (email === null) return
    try {
      const response = await apiFetch(`/exam/students/${student.uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
      })
      if (response.ok) await refresh()
      else alert('Failed to update student.')
    } catch {
      alert('Error updating student.')
    }
  }, [refresh])

  const editSubject = useCallback(async (subject: InstitutionSubject) => {
    const name = window.prompt('Enter new subject name:', subject.name)
    if (!name || !name.trim() || name === subject.name) return
    try {
      const response = await apiFetch(`/exam/update_subject/${subject.uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      })
      if (response.ok) await refresh()
      else {
        const error = await response.json()
        alert(`Error: ${error.detail || 'Failed to update subject'}`)
      }
    } catch {
      alert('An error occurred while updating the subject')
    }
  }, [refresh])

  const deleteSubject = useCallback(async (subjectUid: string) => {
    if (!window.confirm('Are you sure you want to delete this subject?')) return
    try {
      const response = await apiFetch(`/exam/delete_subject/${subjectUid}`, { method: 'DELETE' })
      if (response.ok) await refresh()
      else {
        const error = await response.json()
        alert(`Error: ${error.detail || 'Failed to delete subject'}`)
      }
    } catch {
      alert('An error occurred while deleting the subject')
    }
  }, [refresh])

  return {
    analytics,
    deleteSubject,
    deleteWorkspace,
    editStudent,
    editSubject,
    exams,
    institution,
    loadAnalytics,
    loading,
    loadingAnalytics,
    refresh,
    students,
    subjects,
  }
}
