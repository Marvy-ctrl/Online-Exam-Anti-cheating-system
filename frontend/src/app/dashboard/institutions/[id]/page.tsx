"use client"
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, ChevronRight, FileText, Users, BookOpen, BarChart3, Plus, Trash2, Edit2, ShieldAlert, CheckCircle2, Clock3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import Link from 'next/link'
import { apiFetch } from '@/src/lib/api'
import CreateSubjectModal from '@/src/components/dashboard/CreateSubjectModal'
import CreateExamModal from '@/src/components/dashboard/CreateExamModal'

interface Institution {
  uid: string
  name: string
  logo_url: string | null
}

interface Exam {
  uid: string
  title: string
  duration_minutes: number
  start_time: string
  end_time: string
}

interface Subject {
  uid: string
  name: string
}

interface Student {
  uid: string
  first_name: string
  last_name: string
  email: string
  student_id: string
}

interface AnalyticsOverview {
  total_exams: number
  total_students: number
  total_violations: number
  total_subjects: number
}

interface ViolationDistributionItem {
  violation_type: string
  count: number
}

interface ExamStatusItem {
  status: 'Active' | 'Upcoming' | 'Closed' | string
  count: number
}

interface TopViolatorItem {
  name: string
  violation_count: number
}

interface InstitutionAnalytics {
  overview: AnalyticsOverview
  violation_distribution: ViolationDistributionItem[]
  exam_status_distribution: ExamStatusItem[]
  top_violators: TopViolatorItem[]
}

type Tab = 'exams' | 'students' | 'subjects' | 'analytics'

export default function InstitutionWorkspace() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [institution, setInstitution] = useState<Institution | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('exams')
  const [loading, setLoading] = useState(true)

  // Modals specific to this workspace
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [isExamModalOpen, setIsExamModalOpen] = useState(false)

  // Data
  const [exams, setExams] = useState<Exam[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [analyticsData, setAnalyticsData] = useState<InstitutionAnalytics | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const fetchWorkspaceData = async () => {
    setLoading(true)
    try {
      // 1. Fetch institution details
      const instRes = await apiFetch(`/institutions/${id}`)
      if (!instRes.ok) throw new Error("Institution not found")
      setInstitution(await instRes.json())

      // 2. Fetch Subjects for this institution
      const subRes = await apiFetch(`/exam/subjects?institution_uid=${id}`)
      if (subRes.ok) setSubjects(await subRes.json())

      // 3. Fetch Exams for this institution
      const examRes = await apiFetch(`/exam/get_all_exams?institution_uid=${id}`)
      if (examRes.ok) setExams(await examRes.json())

      // 4. Fetch Master Students Roster
      const stuRes = await apiFetch(`/exam/students?institution_uid=${id}`)
      if (stuRes.ok) setStudents(await stuRes.json())

    } catch (err) {
      console.error(err)
      router.push('/dashboard/institutions') // fallback if invalid
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    if (analyticsData) return // cache for now
    setLoadingAnalytics(true)
    try {
      const res = await apiFetch(`/analytics/institution/${id}`)
      if (res.ok) {
        setAnalyticsData(await res.json())
      }
    } catch (err) {
      console.error("Failed to fetch analytics", err)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'analytics' && id) {
      fetchAnalytics()
    }
  }, [activeTab, id])

  const getExamStatus = (exam: Exam) => {
    const now = new Date()
    const start = new Date(exam.start_time)
    const end = new Date(exam.end_time)
    if (now < start) return { label: 'Upcoming', cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' }
    if (now > end) return { label: 'Closed', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
    return { label: 'Active', cls: 'bg-green-50 text-green-700 border-green-100' }
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
        fetchWorkspaceData()
      } else {
        alert("Failed to update student.")
      }
    } catch (e) {
      alert("Error updating student.")
    }
  }

  const handleDeleteSubject = async (subjectUid: string) => {
    if (!window.confirm("Are you sure you want to delete this subject?")) return;
    try {
      const res = await apiFetch(`/exam/delete_subject/${subjectUid}`, { method: 'DELETE' });
      if (res.ok) {
        fetchWorkspaceData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail || "Failed to delete subject"}`);
      }
    } catch (e) {
      alert("An error occurred while deleting the subject");
    }
  };

  const handleEditSubject = async (subject: Subject) => {
    const newName = window.prompt("Enter new subject name:", subject.name);
    if (!newName || newName.trim() === "" || newName === subject.name) return;
    
    try {
      const res = await apiFetch(`/exam/update_subject/${subject.uid}`, { 
        method: 'PATCH',
        body: JSON.stringify({ name: newName.trim() })
      });
      if (res.ok) {
        fetchWorkspaceData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail || "Failed to update subject"}`);
      }
    } catch (e) {
      alert("An error occurred while updating the subject");
    }
  };

  useEffect(() => {
    if (id) fetchWorkspaceData()
  }, [id])

  if (loading || !institution) {
    return <div className="p-8 flex items-center justify-center text-slate-400 min-h-[50vh]">Loading Workspace...</div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      {/* Breadcrumbs & Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 font-medium">
          <Link href="/dashboard/institutions" className="hover:text-blue-600 transition-colors">Institutions</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900">{institution.name} Workspace</span>
        </div>
        
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
               {institution.logo_url ? (
                   <img
                     src={institution.logo_url}
                     alt={institution.name}
                     className="w-full h-full object-contain"
                   />
                 ) : (
                   <Building2 size={24} className="text-blue-500" />
               )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{institution.name}</h1>
              <p className="text-slate-500 text-sm">Institution Workspace</p>
            </div>
          </div>
          <div className="flex gap-3 text-sm">
            <button 
              onClick={async () => {
                if (window.confirm("Are you sure you want to delete this workspace? This action cannot be undone and will delete all associated subjects and exams.")) {
                  try {
                    const res = await apiFetch(`/institutions/${id}`, { method: 'DELETE' })
                    if (res.ok) {
                      router.push('/dashboard/institutions')
                    } else {
                      const err = await res.json()
                      alert(`Error: ${err.detail || "Failed to delete"}`)
                    }
                  } catch (e) {
                    alert("An error occurred while deleting the workspace")
                  }
                }
              }}
              className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
              title="Delete Workspace"
            >
              <Trash2 size={16}/> Delete
            </button>
            <button 
              onClick={() => setIsSubjectModalOpen(true)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <BookOpen size={16} className="text-blue-600"/> New Subject
            </button>
            <button 
              onClick={() => setIsExamModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus size={16}/> Create Exam
            </button>
          </div>
        </div>
      </div>

      {/* Modern Tab Navigation */}
      <div className="flex items-center gap-6 border-b border-slate-200 mb-8 px-2">
        <button 
          onClick={() => setActiveTab('exams')}
          className={`pb-4 flex items-center gap-2 font-medium text-sm transition-colors relative ${activeTab === 'exams' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <FileText size={16} /> Exams
          {activeTab === 'exams' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('students')}
          className={`pb-4 flex items-center gap-2 font-medium text-sm transition-colors relative ${activeTab === 'students' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Users size={16} /> Enrolled
          {activeTab === 'students' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('subjects')}
          className={`pb-4 flex items-center gap-2 font-medium text-sm transition-colors relative ${activeTab === 'subjects' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <BookOpen size={16} /> Subjects
          {activeTab === 'subjects' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`pb-4 flex items-center gap-2 font-medium text-sm transition-colors relative ${activeTab === 'analytics' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <BarChart3 size={16} /> Analytics
          {activeTab === 'analytics' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
        </button>
      </div>

      {/* Tab Content Areas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 min-h-[400px]">
        {activeTab === 'exams' && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Active Exams</h2>
            {exams.length === 0 ? (
              <p className="text-slate-500">No exams have been created for this institution yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exams.map((exam: Exam) => (
                  <Link 
                    key={exam.uid} 
                    href={`/dashboard/institutions/${id}/exams/${exam.uid}`}
                    className="group flex flex-col p-5 border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all bg-white"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{exam.title}</h3>
                        <p className="text-sm text-slate-500 mt-1">{exam.duration_minutes} minutes</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                    
                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-100">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border ${getExamStatus(exam).cls}`}>
                        {getExamStatus(exam).label}
                      </span>
                      <span className="text-sm font-medium text-blue-600 opacity-0 (-translate-x-2) group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                        Manage Exam
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'subjects' && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Subjects Directory</h2>
            {subjects.length === 0 ? (
              <p className="text-slate-500">No subjects defined in this workspace.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {subjects.map((sub: Subject) => (
                  <li key={sub.uid} className="py-3 flex items-center justify-between group hover:bg-gray-50 px-2 rounded-lg">
                    <Link href={`/dashboard/institutions/${id}/subjects/${sub.uid}`} className="flex items-center gap-3 flex-1 group/link">
                      <BookOpen size={16} className="text-blue-500 group-hover/link:text-blue-600" />
                      <span className="font-medium text-slate-700 group-hover/link:text-blue-600 transition-colors">{sub.name}</span>
                    </Link>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditSubject(sub)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Edit Subject"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteSubject(sub.uid)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete Subject"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'students' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Global Student Directory</h2>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 font-medium text-sm rounded-lg border border-slate-200">
                {students.length} Total
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-4">This view contains all students across all exams in this institution.</p>
            {students.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Users size={32} className="text-slate-300 mb-2" />
                <p className="text-slate-500 font-medium">No students enrolled</p>
                <p className="text-sm text-slate-400">Students will appear here once they accept an exam link or are bulk pre-enrolled.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">ID / Reg No.</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((stu) => (
                      <tr key={stu.uid} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{stu.first_name} {stu.last_name}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-500">{stu.email}</td>
                        <td className="py-3 px-4 text-sm font-mono text-slate-600">{stu.student_id}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Pre-Enrolled
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEditStudent(stu)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit Global Profile"
                            >
                              <Edit2 size={16} />
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

        {activeTab === 'analytics' && (
           <div className="space-y-8">
             {loadingAnalytics ? (
               <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                 <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                 <p>Gathering institution insights...</p>
               </div>
             ) : analyticsData ? (
               <>
                 {/* Summary Cards */}
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-3 text-slate-500 mb-2">
                        <FileText size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Total Exams</span>
                      </div>
                      <div className="text-3xl font-black text-slate-900">{analyticsData.overview.total_exams}</div>
                    </div>
                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-3 text-slate-500 mb-2">
                        <Users size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Students</span>
                      </div>
                      <div className="text-3xl font-black text-slate-900">{analyticsData.overview.total_students}</div>
                    </div>
                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-3 text-slate-500 mb-2">
                        <ShieldAlert size={16} className="text-red-500" />
                        <span className="text-xs font-bold uppercase tracking-wider">Violations</span>
                      </div>
                      <div className="text-3xl font-black text-slate-900">{analyticsData.overview.total_violations}</div>
                    </div>
                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-3 text-slate-500 mb-2">
                        <BookOpen size={16} className="text-blue-500" />
                        <span className="text-xs font-bold uppercase tracking-wider">Subjects</span>
                      </div>
                      <div className="text-3xl font-black text-slate-900">{analyticsData.overview.total_subjects}</div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Violation Breakdown */}
                    <div className="bg-white p-6 border border-slate-100 rounded-2xl">
                      <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <ShieldAlert size={16} className="text-red-500" />
                        Violation Distribution
                      </h3>
                      {analyticsData.violation_distribution.length > 0 ? (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.violation_distribution}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="violation_type" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#f8fafc' }}
                              />
                              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-slate-400 text-sm italic">No violations recorded yet.</div>
                      )}
                    </div>

                    {/* Exam Status */}
                    <div className="bg-white p-6 border border-slate-100 rounded-2xl">
                      <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Clock3 size={16} className="text-blue-500" />
                        Exam Status
                      </h3>
                      <div className="flex items-center gap-8">
                         <div className="h-48 w-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={analyticsData.exam_status_distribution}
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="count"
                                  nameKey="status"
                                >
                                  {analyticsData.exam_status_distribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={
                                      entry.status === 'Active' ? '#22c55e' : 
                                      entry.status === 'Upcoming' ? '#f59e0b' : '#64748b'
                                    } />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                         </div>
                         <div className="flex-1 space-y-4">
                            {analyticsData.exam_status_distribution.map((item) => (
                              <div key={item.status} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${
                                    item.status === 'Active' ? 'bg-green-500' : 
                                    item.status === 'Upcoming' ? 'bg-amber-500' : 'bg-slate-400'
                                  }`} />
                                  <span className="text-sm text-slate-600 font-medium">{item.status}</span>
                                </div>
                                <span className="text-sm font-bold text-slate-900">{item.count}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                 </div>

                 {/* Top Violators List */}
                 <div className="bg-white p-6 border border-slate-100 rounded-2xl">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-blue-500" />
                      Top Alerted Students
                    </h3>
                    {analyticsData.top_violators.length > 0 ? (
                      <div className="divide-y divide-slate-50">
                        {analyticsData.top_violators.map((v, i) => (
                          <div key={i} className="py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                                {i + 1}
                              </div>
                              <span className="text-sm font-medium text-slate-700">{v.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{v.violation_count} Violations</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm italic">All students are currently in good standing.</p>
                    )}
                 </div>
               </>
             ) : (
               <div className="flex flex-col items-center justify-center h-48 text-center">
                  <BarChart3 size={32} className="text-slate-300 mb-2" />
                  <p className="text-slate-500 font-medium">Failed to load analytics</p>
                  <button onClick={fetchAnalytics} className="mt-2 text-sm text-blue-600 hover:underline">Try again</button>
               </div>
             )}
          </div>
        )}
      </div>

      <CreateSubjectModal 
        isOpen={isSubjectModalOpen} 
        onClose={() => setIsSubjectModalOpen(false)} 
        institutionUid={id}
        onSuccess={fetchWorkspaceData} 
      />

      <CreateExamModal 
        isOpen={isExamModalOpen} 
        onClose={() => setIsExamModalOpen(false)} 
        institutionUid={id}
        subjects={subjects}
        onSuccess={fetchWorkspaceData} 
      />
    </div>
  )
}
