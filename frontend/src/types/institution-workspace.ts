export interface InstitutionWorkspaceDetails {
  uid: string
  name: string
  logo_url: string | null
}

export interface InstitutionExam {
  uid: string
  title: string
  duration_minutes: number
  start_time: string
  end_time: string
}

export interface InstitutionSubject {
  uid: string
  name: string
}

export interface InstitutionStudent {
  uid: string
  first_name: string
  last_name: string
  email: string
  student_id: string
}

export interface InstitutionAnalytics {
  overview: {
    total_exams: number
    total_students: number
    total_violations: number
    total_subjects: number
  }
  violation_distribution: Array<{ violation_type: string; count: number }>
  exam_status_distribution: Array<{ status: string; count: number }>
  top_violators: Array<{ name: string; violation_count: number }>
}

export type InstitutionWorkspaceTab = 'exams' | 'students' | 'subjects' | 'analytics'
