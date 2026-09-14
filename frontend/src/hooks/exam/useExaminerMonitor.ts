import { useEffect, useState } from 'react'
import { examinerWebSocketUrl } from '@/src/lib/admin-exam'
import type { EnrolledStudent, LiveExamEvent } from '@/src/types/admin-exam'

interface UseExaminerMonitorOptions {
  enabled: boolean
  examUid: string
  students: EnrolledStudent[]
}

export function useExaminerMonitor({
  enabled,
  examUid,
  students,
}: UseExaminerMonitorOptions) {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<LiveExamEvent[]>([])
  const [feedOpen, setFeedOpen] = useState(true)

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let reconnectTimer: number | null = null
    let socket: WebSocket | null = null

    const connect = () => {
      if (stopped) return
      socket = new WebSocket(examinerWebSocketUrl(examUid))
      socket.onopen = () => setConnected(true)
      socket.onmessage = (messageEvent) => {
        try {
          const payload = JSON.parse(messageEvent.data)
          const violation =
            payload.type === 'student_update'
              ? typeof payload.data === 'string'
                ? JSON.parse(payload.data)
                : payload.data
              : payload.type === 'violation'
                ? payload
                : null

          if (!violation || violation.type !== 'violation') return
          const student = students.find(
            (candidate) => candidate.uid === payload.student_uid,
          )
          const event: LiveExamEvent = {
            id: Date.now() + Math.random(),
            student_name: student
              ? `${student.first_name} ${student.last_name}`
              : 'Unknown Student',
            student_id: student?.student_id || 'N/A',
            violation_type: violation.violation_type || 'Unknown',
            timestamp: violation.timestamp || new Date().toISOString(),
            message: violation.message || '',
          }
          setEvents((current) => [event, ...current].slice(0, 50))
        } catch {
          // Ignore malformed monitoring messages without dropping the connection.
        }
      }
      socket.onclose = (closeEvent) => {
        setConnected(false)
        if (!stopped && closeEvent.code !== 1008) {
          reconnectTimer = window.setTimeout(connect, 2000)
        }
      }
      socket.onerror = () => socket?.close()
    }

    connect()
    return () => {
      stopped = true
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [enabled, examUid, students])

  return { connected, events, feedOpen, setFeedOpen }
}
