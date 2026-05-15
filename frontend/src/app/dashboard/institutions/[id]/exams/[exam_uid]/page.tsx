"use client"
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Users, FileText, Cog, ShieldCheck, Mail, Calendar, Trash2, Edit2, AlertCircle, Copy, Send, CheckCircle, HelpCircle, Activity, ExternalLink, X, Wifi, WifiOff, ShieldAlert, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/src/lib/api'
import QuestionManager from '@/src/components/dashboard/QuestionManager'

interface Exam {
  uid: string
  title: string
  subject_name: string | null
  duration_minutes: number
  description: string | null
  start_time: string
  end_time: string
  enroll_link: string | null
  exam_link: string | null
  link_start_time: string | null
  link_end_time: string | null
  shuffle_questions: boolean
  shuffle_options: boolean
}

interface Student {
  uid: string
  first_name: string
  last_name: string
  email: string
  student_id: string
  status?: string
}

type Tab = 'overview' | 'enrolled' | 'questions' | 'results' | 'settings'

interface ExamResult {
  session_uid: string
  student_uid: string
  student_name: string
  student_id: string
  email: string
  status: string
  score: number | null
  score_percentage: number | null
  adjustment_reason: string | null
  violation_count: number
  violation_summary: string
  end_time: string | null
}

interface LiveEvent {
  id: number
  student_name: string
  student_id: string
  violation_type: string
  timestamp: string
  message: string
}

export default function ExamDetailWorkspace() {
  const params = useParams()
  const router = useRouter()
  const { id, exam_uid } = params as { id: string, exam_uid: string }

  const [exam, setExam] = useState<Exam | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)

  // Link & Invitation State
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [customMessage, setCustomMessage] = useState("")
  const [copySuccess, setCopySuccess] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)

  // Exam Link State
  const [isGeneratingExamLink, setIsGeneratingExamLink] = useState(false)
  const [isSendingExamLink, setIsSendingExamLink] = useState(false)
  const [examLinkCopySuccess, setExamLinkCopySuccess] = useState(false)
  const [sendExamLinkSuccess, setSendExamLinkSuccess] = useState(false)

  // Manual Expiry State
  const [linkStartTime, setLinkStartTime] = useState("")
  const [linkEndTime, setLinkEndTime] = useState("")
  const [isEditingLink, setIsEditingLink] = useState(false)

  // Edit Exam State
  const [editTitle, setEditTitle] = useState("")
  const [editDuration, setEditDuration] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editStartTime, setEditStartTime] = useState("")
  const [editEndTime, setEditEndTime] = useState("")
  const [editShuffleQuestions, setEditShuffleQuestions] = useState(false)
  const [editShuffleOptions, setEditShuffleOptions] = useState(false)
  const [isUpdatingExam, setIsUpdatingExam] = useState(false)
  
  // Results State
  const [results, setResults] = useState<ExamResult[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<ExamResult | null>(null)
  const [newScore, setNewScore] = useState("")
  const [adjReason, setAdjReason] = useState("")
  const [isUpdatingScore, setIsUpdatingScore] = useState(false)
  
  // WebSocket Monitoring State
  const [wsConnected, setWsConnected] = useState(false)
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [showLiveFeed, setShowLiveFeed] = useState(true)
  const wsRef = React.useRef<WebSocket | null>(null)

  // Bulk Selection State
  const [selectedStudentUids, setSelectedStudentUids] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const fetchExamData = async () => {
    setLoading(true)
    try {
      // 1. Fetch Exam Details
      const examRes = await apiFetch(`/exam/${exam_uid}`)
      if (!examRes.ok) throw new Error("Exam not found")
      const data = await examRes.json()
      setExam(data)
      
      // Initialize manual link times
      if (data.start_time) setLinkStartTime(new Date(data.start_time).toISOString().slice(0, 16))
      if (data.end_time) setLinkEndTime(new Date(data.end_time).toISOString().slice(0, 16))

      // Initialize edit state
      if (data.title) setEditTitle(data.title)
      if (data.duration_minutes) setEditDuration(data.duration_minutes.toString())
      if (data.description) setEditDescription(data.description)
      if (data.start_time) setEditStartTime(new Date(data.start_time).toISOString().slice(0, 16))
      if (data.end_time) setEditEndTime(new Date(data.end_time).toISOString().slice(0, 16))
      setEditShuffleQuestions(data.shuffle_questions || false)
      setEditShuffleOptions(data.shuffle_options || false)

      // 2. Fetch students specifically enrolled in this exam
      const stuRes = await apiFetch(`/exam/${exam_uid}/students`)
      if (stuRes.ok) setStudents(await stuRes.json())

    } catch (err) {
      console.error(err)
      router.push(`/dashboard/institutions/${id}`) // gracefully fallback
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExam = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this exam and all its enrollments?")) return
    try {
      const res = await apiFetch(`/exam/delete_exam/${exam_uid}`, { method: 'DELETE' })
      if (res.ok) {
        router.push(`/dashboard/institutions/${id}`)
      } else {
        const err = await res.json()
        alert(`Error: ${err.detail || "Failed to delete exam"}`)
      }
    } catch (e) {
      alert("An error occurred while deleting the exam.")
    }
  }

  const toggleSelectStudent = (uid: string) => {
    setSelectedStudentUids(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedStudentUids.size === students.length) {
      setSelectedStudentUids(new Set())
    } else {
      setSelectedStudentUids(new Set(students.map(s => s.uid)))
    }
  }

  const handleBulkRemoveStudents = async () => {
    if (selectedStudentUids.size === 0) return
    if (!confirm(`Are you sure you want to remove ${selectedStudentUids.size} selected students?`)) return

    setIsBulkDeleting(true)
    try {
      const res = await apiFetch(`/exam/${exam_uid}/bulk-unenroll`, {
        method: 'POST',
        body: JSON.stringify({ student_uids: Array.from(selectedStudentUids) })
      })

      if (res.ok) {
        alert(`Removed ${selectedStudentUids.size} students`)
        setSelectedStudentUids(new Set())
        await fetchExamData()
      } else {
        const data = await res.json()
        alert(data.detail || "Failed to remove students")
      }
    } catch (e) {
      alert("Network error")
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleEditStudent = async (student: Student) => {
    const newName = window.prompt("Enter new first name:", student.first_name)
    if (newName === null) return
    const newLastName = window.prompt("Enter new last name:", student.last_name)
    if (newLastName === null) return
    const newEmail = window.prompt("Enter new email:", student.email)
    if (newEmail === null) return
    
    try {
      const res = await apiFetch(`/exam/students/${student.uid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: newName,
          last_name: newLastName,
          email: newEmail
        })
      })
      if (res.ok) {
        fetchExamData()
      } else {
        alert("Failed to update student.")
      }
    } catch (e) {
      alert("Error updating student.")
    }
  }

  const handleRemoveStudent = async (studentUid: string) => {
    if (!window.confirm("Remove this student from the exam? They will still exist in the Global Master roster.")) return
    try {
      const res = await apiFetch(`/exam/${exam_uid}/enrollment/${studentUid}`, { method: 'DELETE' })
      if (res.ok) {
        fetchExamData()
      } else {
        alert("Failed to remove student.")
      }
    } catch (e) {
      alert("Error removing student.")
    }
  }

  const handleGenerateLink = async () => {
    setIsGenerating(true)
    try {
      const res = await apiFetch(`/exam/${exam_uid}/enroll_link`, {
        method: 'POST',
        body: JSON.stringify({
          link_start_time: linkStartTime,
          link_end_time: linkEndTime
        })
      })
      if (res.ok) {
        fetchExamData()
        setIsEditingLink(false)
      } else {
        alert("Failed to generate enrollment link.")
      }
    } catch (e) {
      alert("Error generating link.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendInvitations = async () => {
    if (students.length === 0) {
      alert("No students are enrolled in this exam yet.")
      return
    }
    setIsSending(true)
    try {
      const res = await apiFetch(`/exam/${exam_uid}/send-invitations`, {
        method: 'POST',
        body: JSON.stringify({ custom_message: customMessage })
      })
      if (res.ok) {
        setSendSuccess(true)
        setTimeout(() => setSendSuccess(false), 3000)
      } else {
        const err = await res.json()
        alert(`Failed to send invitations: ${err.detail || "Unknown error"}`)
      }
    } catch (e) {
      alert("Error sending invitations.")
    } finally {
      setIsSending(false)
    }
  }

  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingExam(true)
    try {
      const res = await apiFetch(`/exam/${exam_uid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle,
          duration_minutes: parseInt(editDuration),
          description: editDescription,
          start_time: new Date(editStartTime).toISOString(),
          end_time: new Date(editEndTime).toISOString(),
          shuffle_questions: editShuffleQuestions,
          shuffle_options: editShuffleOptions,
        })
      })
      if (res.ok) {
        alert("Exam updated successfully!")
        fetchExamData()
      } else {
        const err = await res.json()
        alert(`Error: ${err.detail || "Failed to update exam"}`)
      }
    } catch (e) {
      alert("Error updating exam.")
    } finally {
      setIsUpdatingExam(false)
    }
  }

  const copyToClipboard = (text: string, type: 'enroll' | 'exam' = 'enroll') => {
    navigator.clipboard.writeText(text)
    if (type === 'exam') {
      setExamLinkCopySuccess(true)
      setTimeout(() => setExamLinkCopySuccess(false), 2000)
    } else {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleGenerateExamLink = async () => {
    setIsGeneratingExamLink(true)
    try {
      const res = await apiFetch(`/exam/${exam_uid}/exam-link`, { method: 'POST' })
      if (res.ok) {
        fetchExamData()
      } else {
        const err = await res.json()
        alert(`Failed to generate exam link: ${err.detail || 'Unknown error'}`)
      }
    } catch (e) {
      alert('Error generating exam link.')
    } finally {
      setIsGeneratingExamLink(false)
    }
  }

  const handleSendExamLink = async () => {
    const enrolledCount = students.filter(s => s.status === 'enrolled').length
    if (enrolledCount === 0) {
      alert('No fully enrolled students found. Students must complete face registration before you can send the exam link.')
      return
    }
    setIsSendingExamLink(true)
    try {
      const res = await apiFetch(`/exam/${exam_uid}/send-exam-link`, { method: 'POST' })
      if (res.ok) {
        setSendExamLinkSuccess(true)
        setTimeout(() => setSendExamLinkSuccess(false), 3000)
      } else {
        const err = await res.json()
        alert(`Failed to send exam link: ${err.detail || 'Unknown error'}`)
      }
    } catch (e) {
      alert('Error sending exam link.')
    } finally {
      setIsSendingExamLink(false)
    }
  }

  const fetchResults = async () => {
    setLoadingResults(true)
    try {
      const res = await apiFetch(`/exam_session/${exam_uid}/results`)
      if (res.ok) {
        setResults(await res.json())
      }
    } catch (e) { console.error(e) }
    finally { setLoadingResults(false) }
  }

  useEffect(() => {
    if (activeTab === 'results') fetchResults()
  }, [activeTab])

  // WebSocket Monitoring Connection 

  useEffect(() => {
    if (!exam_uid || !exam) return

    // Only connect if the exam is currently Active
    const status = getExamStatus(exam).label
    if (status !== 'Active') {
      if (wsRef.current) wsRef.current.close()
      setWsConnected(false)
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = process.env.NEXT_PUBLIC_BACKEND_URL 
      ? process.env.NEXT_PUBLIC_BACKEND_URL.replace('http://', '').replace('https://', '')
      : 'localhost:8000'
    const wsUrl = `${protocol}//${host}/api/v1/exam_session/${exam_uid}/monitor/ws`
    
    console.log("Monitor connecting to:", wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setWsConnected(true)
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        
        const studentUid = payload.student_uid
        let violationData = null

        if (payload.type === 'student_update') {
          // Format 1: Nested data string (from Student WebSocket)
          violationData = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data
        } else if (payload.type === 'violation') {
          // Format 2: Direct violation object (from API log_violation)
          violationData = payload
        }

        if (violationData && (violationData.type === 'violation' || payload.type === 'violation')) {
          // Find student name from our list
          const student = students.find(s => s.uid === studentUid)
          const newEvent = {
            id: Date.now() + Math.random(),
            student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown Student',
            student_id: student?.student_id || 'N/A',
            violation_type: violationData.violation_type || 'Unknown',
            timestamp: violationData.timestamp || new Date().toISOString(),
            message: violationData.message || ''
          }
          setLiveEvents(prev => [newEvent, ...prev].slice(0, 50)) // Keep last 50
        }
      } catch (e) { console.error("Failed to parse WS message", e) }
    }
    ws.onclose = () => setWsConnected(false)

    return () => ws.close()
  }, [exam_uid, students, exam])

  const handleUpdateScore = async () => {
    if (!selectedSession) return
    setIsUpdatingScore(true)
    try {
      const res = await apiFetch(`/exam_session/session/${selectedSession.session_uid}/update-score`, {
        method: 'POST',
        body: JSON.stringify({
          new_score: parseFloat(newScore),
          adjustment_reason: adjReason
        })
      })
      if (res.ok) {
        setShowScoreModal(false)
        fetchResults()
      } else {
        alert("Failed to update score.")
      }
    } catch (e) { alert("Error updating score") }
    finally { setIsUpdatingScore(false) }
  }

  const getExamStatus = (exam: Exam) => {
    const now = new Date()
    const start = new Date(exam.start_time)
    const end = new Date(exam.end_time)
    if (now < start) return { label: 'Upcoming', cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' }
    if (now > end) return { label: 'Closed', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
    return { label: 'Active', cls: 'bg-green-50 text-green-700 border-green-100' }
  }

  useEffect(() => {
    if (exam_uid) fetchExamData()
  }, [exam_uid])

  if (loading || !exam) {
    return <div className="p-8 flex items-center justify-center text-slate-400 min-h-[50vh]">Loading Exam Details...</div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 font-medium">
        <Link href="/dashboard/institutions" className="hover:text-blue-600 transition-colors">Institutions</Link>
        <ChevronRight size={14} />
        <Link href={`/dashboard/institutions/${id}`} className="hover:text-blue-600 transition-colors">Workspace</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 truncate max-w-[200px]">{exam.title}</span>
      </div>

      {/* Header Context */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <FileText size={20} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{exam.title}</h1>
            <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border ${getExamStatus(exam).cls}`}>
              {getExamStatus(exam).label}
            </span>
            {wsConnected && getExamStatus(exam).label === 'Active' && (
              <div className="flex items-center gap-2 px-2 py-1 bg-green-50 border border-green-100 rounded-md">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Live Monitoring Active</span>
              </div>
            )}
          </div>
          <p className="text-slate-500 text-sm ml-13 flex items-center gap-2">
            <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {exam.subject_name || "No Subject Assigned"}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">
              {exam_uid.split('-')[0]}
            </span>
            <span className="text-slate-300">•</span>
            <span>{exam.duration_minutes} Minutes</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleDeleteExam}
            className="px-4 py-2 bg-white text-red-600 font-medium rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 transition-colors flex items-center gap-2"
          >
            <Trash2 size={16}/> Delete Exam
          </button>
          
          <Link 
            href={`/dashboard/institutions/${id}/exams/${exam_uid}/pre-enroll`}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20"
          >
            <Users size={16}/> Bulk Pre-Enroll
          </Link>
        </div>
      </div>

      {/* Modern Tab Navigation */}
      <div className="flex items-center gap-6 border-b border-slate-200 mb-8 px-2">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`pb-4 flex items-center gap-2 font-medium text-sm transition-colors relative ${activeTab === 'overview' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <FileText size={16} /> Overview
          {activeTab === 'overview' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('enrolled')}
          className={`pb-4 flex items-center gap-2 font-medium text-sm transition-colors relative ${activeTab === 'enrolled' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Users size={16} /> Enrolled Students
          {activeTab === 'enrolled' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('questions')}
          className={`pb-4 flex items-center gap-2 font-medium text-sm transition-colors relative ${activeTab === 'questions' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <HelpCircle size={16} /> Questions
          {activeTab === 'questions' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('results')}
          className={`pb-4 flex items-center gap-2 font-medium text-sm transition-colors relative ${activeTab === 'results' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <CheckCircle size={16} /> Results & Grading
          {activeTab === 'results' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`pb-4 flex items-center gap-2 font-medium text-sm transition-colors relative ${activeTab === 'settings' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Cog size={16} /> Configuration
          {activeTab === 'settings' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
        </button>
      </div>

      {/* Tab Context Container */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Exam Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</div>
                  <div className="text-slate-900 font-medium">{exam.duration_minutes} Minutes</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Time Window</div>
                  <div className="text-slate-900 font-medium text-sm">
                    {new Date(exam.start_time).toLocaleString()} - {new Date(exam.end_time).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Description</h2>
              <p className="text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                {exam.description || "No description provided for this exam."}
              </p>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Send size={20} className="text-blue-600" />
                Enrollment & Invitations
              </h2>

              {!exam.enroll_link ? (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
                  <AlertCircle className="text-blue-600 mx-auto mb-3" size={32} />
                  <h3 className="font-bold text-blue-900 mb-1">No Enrollment Link Generated</h3>
                  <p className="text-blue-700 text-sm mb-6 max-w-md mx-auto">
                    Students need a secure link to verify their identities and join this exam. 
                    Generate one now to start inviting your candidates.
                  </p>
                  <button 
                    onClick={() => setIsEditingLink(true)}
                    className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                  >
                    Setup Enrollment Link
                  </button>

                  {isEditingLink && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                         <h3 className="text-xl font-bold text-slate-900 mb-2">Configure Enrollment Window</h3>
                         <p className="text-sm text-slate-500 mb-6">Set the specific dates when students are allowed to use this link.</p>
                         
                         <div className="space-y-4 mb-8">
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enrollment Opens</label>
                              <input 
                                type="datetime-local" 
                                value={linkStartTime}
                                onChange={(e) => setLinkStartTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enrollment Closes (Expiry)</label>
                              <input 
                                type="datetime-local" 
                                value={linkEndTime}
                                onChange={(e) => setLinkEndTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                              />
                            </div>
                         </div>

                         <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setIsEditingLink(false)}
                              className="flex-1 py-2.5 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={handleGenerateLink}
                              disabled={isGenerating}
                              className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                            >
                              {isGenerating ? "Generating..." : "Generate Link"}
                            </button>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Link Status */}
                  <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Secure Enrollment Link</span>
                        <div className="flex items-center gap-3">
                           <button 
                             onClick={() => setIsEditingLink(true)}
                             className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                           >
                             Update Window
                           </button>
                           <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold px-2 py-0.5 bg-green-50 border border-green-100 rounded-md">
                             <CheckCircle size={12} /> Active
                           </div>
                        </div>
                      </div>
                      
                      {isEditingLink && (
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                             <h3 className="text-xl font-bold text-slate-900 mb-2">Update Enrollment Window</h3>
                             <p className="text-sm text-slate-500 mb-6">Modify when the enrollment link expires.</p>
                             
                             <div className="space-y-4 mb-8">
                                <div>
                                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enrollment Opens</label>
                                  <input 
                                    type="datetime-local" 
                                    value={linkStartTime}
                                    onChange={(e) => setLinkStartTime(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enrollment Closes (Expiry)</label>
                                  <input 
                                    type="datetime-local" 
                                    value={linkEndTime}
                                    onChange={(e) => setLinkEndTime(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                  />
                                </div>
                             </div>

                             <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => setIsEditingLink(false)}
                                  className="flex-1 py-2.5 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={handleGenerateLink}
                                  disabled={isGenerating}
                                  className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                                >
                                  {isGenerating ? "Updating..." : "Update Link"}
                                </button>
                             </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                          <Calendar size={10} /> Enrollment Window
                        </div>
                        <div className="text-[11px] font-medium text-slate-600">
                          {exam.link_start_time ? new Date(exam.link_start_time).toLocaleString() : 'N/A'} 
                          <span className="mx-1 text-slate-300">→</span>
                          <span className={new Date(exam.link_end_time || '') < new Date() ? 'text-red-500' : ''}>
                            {exam.link_end_time ? new Date(exam.link_end_time).toLocaleString() : 'No Deadline'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input 
                          readOnly 
                          value={exam.enroll_link} 
                          className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono text-slate-600 outline-none"
                        />
                        <button 
                          onClick={() => copyToClipboard(exam.enroll_link!, 'enroll')}
                          className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                          title="Copy Link"
                        >
                          {copySuccess ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-3 italic">
                         Send link directly to students or copy to clipboard
                      </p>
                    </div>
                  </div>

                  {/* Invitation Tool */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Mail size={18} className="text-blue-600" />
                      Send Email Invitations
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Custom Message (Optional)</label>
                        <textarea 
                          placeholder="e.g. Please complete your identity verification by tomorrow noon..."
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-none"
                        />
                      </div>
                      <button 
                        onClick={handleSendInvitations}
                        disabled={isSending || students.filter(s => s.status !== 'enrolled').length === 0}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                          sendSuccess 
                            ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        {isSending ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Sending...
                          </>
                        ) : sendSuccess ? (
                          <>
                            <CheckCircle size={18} />
                            Invitations Sent!
                          </>
                        ) : (
                          <>
                            <Send size={18} />
                            Send to {students.filter(s => s.status !== 'enrolled').length} Pending Students
                          </>
                        )}
                      </button>
                      {students.filter(s => s.status !== 'enrolled').length === 0 && students.length > 0 && (
                        <p className="text-center text-[11px] text-green-500 mt-2 font-medium">
                          ✓ All students have successfully enrolled. No emails to send.
                        </p>
                      )}
                      {students.length === 0 && (
                        <p className="text-center text-[11px] text-red-500 mt-2 font-medium">
                          ⚠️ You must add students first before sending invitations.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Exam Link Section */}
            <div className="pt-6 border-t border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <ShieldCheck size={20} className="text-green-600" />
                Exam Entry Link
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Generate a secure exam link and send it to all fully enrolled students on exam day.
                The link is only valid during the exam window ({new Date(exam.start_time).toLocaleString()} → {new Date(exam.end_time).toLocaleString()}).
              </p>

              {!exam.exam_link ? (
                <div className="bg-green-50 border border-green-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-green-900 mb-1">No Exam Link Generated Yet</h3>
                    <p className="text-green-700 text-sm">Generate a link to allow enrolled students to enter the exam.</p>
                  </div>
                  <button
                    onClick={handleGenerateExamLink}
                    disabled={isGeneratingExamLink}
                    className="shrink-0 px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGeneratingExamLink ? 'Generating...' : 'Generate Exam Link'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exam Entry Link</span>
                      <button
                        onClick={handleGenerateExamLink}
                        disabled={isGeneratingExamLink}
                        className="text-[10px] font-bold text-green-600 hover:bg-green-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                      >
                        {isGeneratingExamLink ? 'Regenerating...' : 'Regenerate'}
                      </button>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input
                        readOnly
                        value={exam.exam_link}
                        className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono text-slate-600 outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(exam.exam_link!, 'exam')}
                        className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                        title="Copy Link"
                      >
                        {examLinkCopySuccess ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 italic">Share this link directly or use the email button →</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                      <Mail size={18} className="text-green-600" />
                      Send to Enrolled Students
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Emails the exam link to all <strong>{students.filter(s => s.status === 'enrolled').length}</strong> fully enrolled students.
                    </p>
                    <button
                      onClick={handleSendExamLink}
                      disabled={isSendingExamLink || sendExamLinkSuccess || students.filter(s => s.status === 'enrolled').length === 0}
                      className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        sendExamLinkSuccess
                          ? 'bg-green-600 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      {isSendingExamLink ? (
                        <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Sending...</>
                      ) : sendExamLinkSuccess ? (
                        <><CheckCircle size={18} /> Exam Links Sent!</>
                      ) : (
                        <><Send size={18} /> Send Exam Link to Students</>
                      )}
                    </button>
                    {students.filter(s => s.status === 'enrolled').length === 0 && (
                      <p className="text-center text-[11px] text-amber-600 mt-2 font-medium">
                        No fully enrolled students yet. Students must complete face registration first.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'enrolled' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-slate-900">Enrolled Students</h2>
                {selectedStudentUids.size > 0 && (
                  <button 
                    onClick={handleBulkRemoveStudents}
                    disabled={isBulkDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 font-bold text-xs  hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {isBulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Delete Selected ({selectedStudentUids.size})
                  </button>
                )}
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 font-medium text-sm rounded-lg border border-slate-200">
                {students.length} Total
              </span>
            </div>

            {students.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                 <Users size={32} className="text-slate-300 mb-2" />
                 <p className="text-slate-500 font-medium">No students enrolled</p>
                 <p className="text-sm text-slate-400 mt-1 max-w-sm">Use the Bulk Pre-Enroll tool to add students, or generate an enrollment link.</p>
               </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-10">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={students.length > 0 && selectedStudentUids.size === students.length}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Reg Number</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {students.map((stu) => (
                      <tr key={stu.uid} className={`hover:bg-slate-50/50 transition-colors group ${selectedStudentUids.has(stu.uid) ? 'bg-blue-50/30' : ''}`}>
                        <td className="py-3 px-4">
                           <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedStudentUids.has(stu.uid)}
                            onChange={() => toggleSelectStudent(stu.uid)}
                          />
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {stu.first_name} {stu.last_name}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{stu.email}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{stu.student_id}</td>
                        <td className="py-3 px-4 text-center">
                          {stu.status === 'enrolled' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                              <CheckCircle size={12} /> Enrolled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              <ShieldCheck size={12} /> Pending Validation
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEditStudent(stu)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit Student Profile"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleRemoveStudent(stu.uid)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Remove From Exam"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Exam Results & Autograde</h2>
                  <p className="text-sm text-slate-500">View student performance and adjust marks if necessary.</p>
                </div>
                <button 
                  onClick={fetchResults}
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                  title="Refresh Results"
                >
                  <Calendar size={18} className={loadingResults ? "animate-spin" : ""} />
                </button>
             </div>

             {loadingResults ? (
               <div className="py-20 text-center text-slate-400">Loading results...</div>
             ) : results.length === 0 ? (
               <div className="py-20 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                 No submissions yet. Results will appear here once students submit their exams.
               </div>
             ) : (
               <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Score</th>
                        <th className="py-3 px-4">Percentage</th>
                        <th className="py-3 px-4">Violations</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {results.map((res) => (
                        <tr key={res.session_uid} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="py-3 px-4">
                              <Link 
                                href={`/dashboard/institutions/${id}/exams/${exam_uid}/audit/${res.session_uid}`}
                                className="text-left group/name block"
                              >
                                <div className="font-medium text-slate-900 group-hover/name:text-blue-600 transition-colors flex items-center gap-1.5">
                                  {res.student_name}
                                  <ExternalLink size={12} className="opacity-0 group-hover/name:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-xs text-slate-400 font-mono">{res.student_id}</div>
                              </Link>
                           </td>
                           <td className="py-3 px-4 font-bold text-slate-700">{res.score ?? '--'}</td>
                           <td className="py-3 px-4">
                              {res.score_percentage !== null ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-blue-500 h-full" style={{ width: `${res.score_percentage}%` }}></div>
                                  </div>
                                  <span className="font-semibold text-slate-600">{res.score_percentage.toFixed(1)}%</span>
                                </div>
                              ) : '--'}
                           </td>
                           <td className="py-3 px-4">
                              {res.violation_count > 0 ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-xs font-bold">
                                    <AlertCircle size={10} /> {res.violation_count} Violations
                                  </span>
                                  {res.violation_summary && res.violation_summary !== 'None' && (
                                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                                      {res.violation_summary}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">No violations</span>
                              )}
                           </td>
                           <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                res.status === 'Submitted' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                              }`}>
                                {res.status}
                              </span>
                           </td>
                           <td className="py-3 px-4 text-right">
                              <button 
                                onClick={() => {
                                  setSelectedSession(res)
                                  setNewScore(res.score?.toString() || "")
                                  setAdjReason(res.adjustment_reason || "")
                                  setShowScoreModal(true)
                                }}
                                className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 hover:border-blue-300 transition-all"
                              >
                                Edit Score
                              </button>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
             )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <QuestionManager examUid={exam_uid} />
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="max-w-2xl">
             <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
               <Cog size={20} className="text-blue-600" />
               Exam Configuration
             </h2>
             <form onSubmit={handleUpdateExam} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exam Title</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-y"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Duration (Mins)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">End Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl transition-all hover:border-blue-200">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Shuffle Questions</h4>
                      <p className="text-xs text-slate-500">Each student will receive questions in a different order.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editShuffleQuestions}
                        onChange={(e) => setEditShuffleQuestions(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl transition-all hover:border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Shuffle Options</h4>
                        <p className="text-xs text-slate-500">Randomize the order of choices within each question.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editShuffleOptions}
                          onChange={(e) => setEditShuffleOptions(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {editShuffleOptions && (
                      <div className="mt-4 p-3 bg-white border border-amber-200 rounded-xl flex gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                        <AlertCircle className="text-amber-600 shrink-0" size={18} />
                        <div className="text-xs text-amber-800 leading-relaxed">
                          <p className="font-bold mb-1">Notice: Potential Question Ambiguity</p>
                          <p>Option shuffling may affect questions containing phrases like:</p>
                          <ul className="list-disc ml-4 mt-1 space-y-0.5">
                            <li>All of the above</li>
                            <li>None of the above</li>
                            <li>Both A and B</li>
                          </ul>
                          <p className="mt-2 italic">Consider using position-independent wording instead.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingExam}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {isUpdatingExam ? "Saving Changes..." : "Save Configuration"}
                </button>
             </form>
           </div>
        )}
      </div>

      {/* Update Score Modal */}
      {showScoreModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Adjust Student Score</h3>
              <p className="text-sm text-slate-500 mb-6">Manually update <strong>{selectedSession?.student_name}</strong>`s results.</p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">New Score (Marks)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={newScore}
                    onChange={(e) => setNewScore(e.target.value)}
                    placeholder="Enter raw score"
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reason for Adjustment</label>
                  <textarea 
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    placeholder="e.g. Penalized for tab switching violations"
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowScoreModal(false)}
                  className="flex-1 py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateScore}
                  disabled={isUpdatingScore}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {isUpdatingScore ? "Updating..." : "Save Changes"}
                </button>
              </div>
           </div>
        </div>
      )}
      {/* Live Activity Feed Overlay */}
      {wsConnected && showLiveFeed && getExamStatus(exam).label === 'Active' && (
        <div className="fixed bottom-6 right-6 w-80 max-h-[400px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40 animate-in slide-in-from-right duration-300">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-green-400" />
              <span className="text-xs font-bold uppercase tracking-widest">Live Activity Feed</span>
            </div>
            <button onClick={() => setShowLiveFeed(false)} className="hover:text-slate-400 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {liveEvents.length === 0 ? (
              <div className="py-10 text-center">
                <ShieldCheck size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">No recent activity</p>
              </div>
            ) : (
              liveEvents.map(event => (
                <div key={event.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-900 truncate max-w-[140px]">{event.student_name}</span>
                    <span className="text-[8px] font-mono text-slate-400">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldAlert size={10} className="text-red-500" />
                    <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">{event.violation_type.replace(/_/g, ' ')}</span>
                  </div>
                  {event.message && <p className="text-[9px] text-slate-500 italic leading-tight">{event.message}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Re-open Live Feed button */}
      {wsConnected && !showLiveFeed && getExamStatus(exam).label === 'Active' && (
        <button 
          onClick={() => setShowLiveFeed(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-slate-900 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform z-40"
        >
          <Activity size={20} className="text-green-400" />
          {liveEvents.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {liveEvents.length}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
