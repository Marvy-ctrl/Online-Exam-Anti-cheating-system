import { useCallback, useEffect, useRef, useState } from 'react'
import { examWebSocketUrl } from '@/src/lib/exam-api'
import type { ExamIdentity } from '@/src/types/exam'

export function useExamWebSocket(identity: ExamIdentity, enabled: boolean) {
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let stopped = false

    const connect = () => {
      if (stopped) return
      const socket = new WebSocket(examWebSocketUrl(identity))
      socketRef.current = socket

      socket.onopen = () => {
        setConnected(true)
        socket.send(
          JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          }),
        )
      }
      socket.onclose = (event) => {
        setConnected(false)
        const rejectedByServer = event.code === 1008
        if (!stopped && !rejectedByServer) {
          reconnectTimerRef.current = window.setTimeout(connect, 2000)
        }
      }
      socket.onerror = () => socket.close()
    }

    connect()
    return () => {
      stopped = true
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
      }
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [enabled, identity])

  const sendViolation = useCallback((type: string, message: string) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) return
    socket.send(
      JSON.stringify({
        type: 'violation',
        violation_type: type,
        message,
        timestamp: new Date().toISOString(),
      }),
    )
  }, [])

  return { connected, sendViolation }
}
