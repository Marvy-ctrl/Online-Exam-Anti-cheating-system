import { useCallback, useEffect, useRef, useState } from 'react'
import { examSessionUrl } from '@/src/lib/exam-api'
import type { ExamIdentity, FaceStatus } from '@/src/types/exam'

interface UseWebcamMonitorOptions {
  enabled: boolean
  identity: ExamIdentity
  onCameraUnavailable: () => void
  sendViolation: (type: string, message: string) => void
}

export function useWebcamMonitor({
  enabled,
  identity,
  onCameraUnavailable,
  sendViolation,
}: UseWebcamMonitorOptions) {
  const mobileVideoRef = useRef<HTMLVideoElement>(null)
  const desktopVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [faceStatus, setFaceStatus] = useState<FaceStatus>('checking')
  const [nextCheckIn, setNextCheckIn] = useState(20)

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
    for (const video of [mobileVideoRef.current, desktopVideoRef.current]) {
      if (video) video.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const acquire = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 },
        })
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = mediaStream
        setStream(mediaStream)
      } catch {
        onCameraUnavailable()
      }
    }

    void acquire()
    return () => {
      cancelled = true
      stopWebcam()
    }
  }, [enabled, onCameraUnavailable, stopWebcam])

  useEffect(() => {
    if (!stream) return
    if (mobileVideoRef.current) mobileVideoRef.current.srcObject = stream
    if (desktopVideoRef.current) desktopVideoRef.current.srcObject = stream
  }, [stream])

  const captureFace = useCallback(async () => {
    const video = mobileVideoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    if (video.videoWidth === 0 || video.videoHeight === 0) return

    setFaceStatus('checking')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0)
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1]

    try {
      const response = await fetch(examSessionUrl(identity, '/verify-face'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ face_image: base64Image }),
      })
      const result = await response.json()
      if (result.status === 'ok') {
        setFaceStatus('ok')
      } else if (result.status === 'queued') {
        setFaceStatus('checking')
      } else {
        setFaceStatus('warning')
        sendViolation(
          result.violation_type || 'face_check_failed',
          result.message || 'Face verification failed',
        )
      }
    } catch {
      setFaceStatus('warning')
    }
  }, [identity, sendViolation])

  useEffect(() => {
    if (!enabled || !stream) return
    const countdown = window.setInterval(() => {
      setNextCheckIn((current) => (current <= 1 ? 20 : current - 1))
    }, 1000)
    const faceCheck = window.setInterval(() => void captureFace(), 20_000)
    return () => {
      window.clearInterval(countdown)
      window.clearInterval(faceCheck)
    }
  }, [captureFace, enabled, stream])

  return {
    canvasRef,
    desktopVideoRef,
    faceStatus,
    mobileVideoRef,
    nextCheckIn,
    stopWebcam,
  }
}
