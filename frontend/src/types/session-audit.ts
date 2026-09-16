export interface AuditSnapshot {
  url: string
  face_matches: boolean
  multiple_faces: boolean
  time: string
  violation_type?: string
  occurrence_count?: number
  last_seen_at?: string
}

export interface AuditViolation {
  type: string
  time: string
  metadata?: { count?: number }
}

export interface SessionAuditDetails {
  session_uid: string
  student_name: string
  student_id: string
  email: string
  start_time: string
  end_time: string | null
  status: string
  score: number | null
  total_marks: number
  score_percentage: number | null
  adjustment_reason: string | null
  violations: AuditViolation[]
  snapshots: AuditSnapshot[]
}

export type ViolationSeverity = 'critical' | 'high' | 'medium'
