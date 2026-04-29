"use client"
import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Camera, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react'

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/v1`;

export default function FaceRegistrationPage() {
  const params = useParams()
  const router = useRouter()
  const enrollmentUid = params.uid as string

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  // Start camera on mount
  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setError("")
    } catch (err) {
      setError("Unable to access camera. Please allow camera permissions.")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    // Forcefully stop any underlying active tracks bounded to the video tag
    if (videoRef.current && videoRef.current.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream
      mediaStream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (video && canvas) {
      // Set canvas size to video size
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Convert to base64, removing the "data:image/jpeg;base64," prefix for the backend
        const base64Image = canvas.toDataURL('image/jpeg').split(',')[1]
        setCapturedImage(base64Image)
        
        // Stop camera after capture to save resources
        stopCamera()
      }
    }
  }

  const retakePhoto = () => {
    setCapturedImage(null)
    startCamera()
  }

  const submitFace = async () => {
    if (!capturedImage) return

    setLoading(true)
    setError("")

    try {
      const res = await fetch(`${BASE_URL}/student/enroll/face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_uid: enrollmentUid,
          face_image: capturedImage,
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.exam_uid) {
          const enrolledExams = JSON.parse(localStorage.getItem('enrolled_exams') || '[]')
          if (!enrolledExams.includes(data.exam_uid)) {
            enrolledExams.push(data.exam_uid)
            localStorage.setItem('enrolled_exams', JSON.stringify(enrolledExams))
          }
        }
        setSuccess(true)
      } else {
        const errData = await res.json()
        setError(errData.detail || "Failed to register face. Please try again.")
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Fully Enrolled!</h1>
          <p className="text-slate-500 mb-6">
            Your face has been securely registered. Your enrollment is now complete.
          </p>
          {/* <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Your Enrollment ID</div>
            <div className="font-mono text-sm text-slate-700 break-all">{enrollmentUid}</div>
          </div> */}
          <p className="text-xs text-slate-400 mt-6">
            Wishing you Goodluck in your academics
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/20">
            <Camera size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Face Registration</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Please capture your face to verify your identity for exams. Ensure you are in a well-lit area.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {error && (
            <div className="m-4 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative bg-slate-900 aspect-[4/3] flex items-center justify-center overflow-hidden">
            {!capturedImage ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
            ) : (
              <img 
                src={`data:image/jpeg;base64,${capturedImage}`} 
                alt="Captured Face" 
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Overlay guidelines when capturing */}
            {!capturedImage && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[15%] left-[50%] -translate-x-1/2 w-[60%] h-[70%] border-2 border-dashed border-white/50 rounded-[40%] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
              </div>
            )}
          </div>

          <div className="p-6">
            {/* Hidden canvas for capturing the image */}
            <canvas ref={canvasRef} className="hidden" />

            {!capturedImage ? (
              <button
                onClick={capturePhoto}
                disabled={!stream}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Camera size={18} />
                Capture Face
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={retakePhoto}
                  disabled={loading}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Retake
                </button>
                <button
                  onClick={submitFace}
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Verifying...</>
                  ) : (
                    <>Submit <ArrowRight size={18} /></>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
