"use client";

import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { AlertCircle, Loader2 } from "lucide-react";
import { ENROLLMENT_STEPS, StepProgress } from "./StepProgress";

export interface FaceEnrollmentSuccessData {
  message?: string;
  enrollment_uid?: string;
  exam_uid?: string;
  face_registered?: boolean;
  images_submitted?: number;
  images_passed_quality?: number;
  embedding_vector_length?: number;
}

interface FaceEnrollmentFlowProps {
  enrollmentUid: string;
  onSuccess: (data: FaceEnrollmentSuccessData) => void;
  onError: (msg: string) => void;
}

export function FaceEnrollmentFlow({
  enrollmentUid,
  onSuccess,
  onError,
}: FaceEnrollmentFlowProps) {
  // State for steps
  const [currentStepId, setCurrentStepId] = useState<number>(1);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusText, setStatusText] = useState<string>(
    "Loading face detection models...",
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastCaptureTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Refs to hold latest values so the animation-frame loop never reads stale closures
  const currentStepRef = useRef<number>(1);
  const submittingRef = useRef<boolean>(false);
  const capturedImagesRef = useRef<string[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    currentStepRef.current = currentStepId;
  }, [currentStepId]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    capturedImagesRef.current = capturedImages;
  }, [capturedImages]);

  // Constants
  const MIN_BRIGHTNESS = 80;
  const CAPTURE_COOLDOWN = 2000;

  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

  // Initialize
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setLoading(true);
        setStatusText("Loading face detection models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        ]);

        if (!isMounted) return;
        setStatusText("Initializing camera...");
        await startCamera();
        setLoading(false);
      } catch (err) {
        console.error("Initialization error:", err);
        if (isMounted) {
          const msg = "Failed to initialize camera or load models. Please check permissions and connection.";
          setErrorMsg(msg);
          onError(msg);
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      stopCamera();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setErrorMsg(null);
    } catch (err) {
      console.error("Camera error:", err);
      const msg = "Unable to access camera. Please allow camera permissions.";
      setErrorMsg(msg);
      onError(msg);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Helper: check brightness
  const checkBrightness = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
  ): boolean => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;

    ctx.drawImage(video, 0, 0, 64, 48);
    const imageData = ctx.getImageData(0, 0, 64, 48);
    const data = imageData.data;

    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += luminance;
    }
    const avgBrightness = sum / (data.length / 4);

    return avgBrightness >= MIN_BRIGHTNESS;
  };

  // Check if pose matches current step requirement
  const checkPose = (
    landmarks: faceapi.FaceLandmarks68,
    stepId: number,
  ): boolean => {
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    const leftJawX = jaw[0].x;
    const rightJawX = jaw[16].x;
    const noseBaseX = nose[3].x;
    const noseBaseY = nose[3].y;
    const topJawY = (jaw[0].y + jaw[16].y) / 2;
    const bottomJawY = jaw[8].y;

    const faceWidth = rightJawX - leftJawX;
    const faceHeight = bottomJawY - topJawY;

    const noseRatioX = (noseBaseX - leftJawX) / faceWidth;
    const noseRatioY = (noseBaseY - topJawY) / faceHeight;

    switch (stepId) {
      case 1: // Front — centered
        return noseRatioX > 0.42 && noseRatioX < 0.58 && noseRatioY > 0.38 && noseRatioY < 0.62;
      case 2: // Turn Left (nose moves toward right edge from camera POV)
        return noseRatioX > 0.60;
      case 3: // Turn Right (nose moves toward left edge from camera POV)
        return noseRatioX < 0.40;
      case 4: // Chin Up (nose rises in frame)
        return noseRatioY < 0.42;
      case 5: { // Smile
        const mouth = landmarks.getMouth();
        const mouthWidth = mouth[6].x - mouth[0].x;
        return mouthWidth / faceWidth > 0.42;
      }
      default:
        return false;
    }
  };

  // The detection loop reads all live values from refs, never from the closed-over state
  const detectLoop = async () => {
    const stepId = currentStepRef.current;
    const isSubmitting = submittingRef.current;

    if (!videoRef.current || !canvasRef.current || stepId > 5 || isSubmitting) {
      return;
    }

    const video = videoRef.current;
    if (video.paused || video.ended) {
      requestRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    try {
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5,
      });
      const detection = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks(true);

      if (detection) {
        const currentStepConfig = ENROLLMENT_STEPS[stepId - 1];
        if (currentStepConfig) {
          setStatusText(currentStepConfig.instruction);
        }

        const isBrightEnough = checkBrightness(video, canvasRef.current);
        const isCorrectPose = checkPose(detection.landmarks, stepId);

        const now = Date.now();
        if (
          isBrightEnough &&
          isCorrectPose &&
          now - lastCaptureTimeRef.current > CAPTURE_COOLDOWN
        ) {
          lastCaptureTimeRef.current = now;
          captureAndProceed();
          return;
        } else if (!isBrightEnough) {
          setStatusText("Too dark. Move to a brighter area.");
        }
      } else {
        setStatusText("No face detected. Please face the camera.");
      }
    } catch (e) {
      // Ignore occasional detection errors
    }

    requestRef.current = requestAnimationFrame(detectLoop);
  };

  const captureAndProceed = () => {
    const video = videoRef.current;
    if (!video) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const base64Image = tempCanvas.toDataURL("image/jpeg").split(",")[1];

    setCapturedImages((prev) => {
      const updated = [...prev, base64Image];

      // Update the ref immediately so the next detectLoop tick sees it
      capturedImagesRef.current = updated;

      if (updated.length >= 5) {
        submitBatch(updated);
      } else {
        const nextStep = updated.length + 1;
        setCurrentStepId(nextStep);
        // Update ref immediately so the rescheduled detectLoop reads the new step
        currentStepRef.current = nextStep;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
          requestRef.current = requestAnimationFrame(detectLoop);
        }, 1000);
      }
      return updated;
    });
  };

  const submitBatch = async (images: string[]) => {
    setSubmitting(true);
    submittingRef.current = true;
    setStatusText("Verifying and saving your face data...");
    stopCamera();

    const BASE_URL =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    try {
      const res = await fetch(`${BASE_URL}/api/v1/student/enroll/face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_uid: enrollmentUid,
          face_images: images,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess(data);
      } else {
        const msg = data.detail || "Failed to register face. Please try again.";
        setErrorMsg(msg);
        onError(msg);
      }
    } catch (err) {
      const msg = "Network error. Please check your connection and try again.";
      setErrorMsg(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  // Main UI render
  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Face Registration</h2>
        <p className="text-sm text-slate-500 mt-1">
          Complete 5 steps to secure your identity
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="relative mx-auto w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-slate-100 shadow-inner bg-slate-900 flex items-center justify-center">
        {/* Always render video so ref is available, hide if loading */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${loading || submitting ? "opacity-0" : "opacity-100"}`}
          onPlay={() => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            requestRef.current = requestAnimationFrame(detectLoop);
          }}
        />

        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
            <Loader2 size={32} className="animate-spin text-blue-400" />
            <span className="text-sm px-4 text-center">{statusText}</span>
          </div>
        )}

        {submitting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
            <Loader2 size={32} className="animate-spin text-green-400" />
            <span className="text-sm px-4 text-center">{statusText}</span>
          </div>
        )}

        {!loading && !submitting && (
          <>
            {/* Overlay instruction */}
            <div className="absolute bottom-6 left-0 right-0 text-center px-4 z-20">
              <div className="inline-block bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
                {statusText}
              </div>
            </div>
            {/* Alignment guide */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
              <div
                className={`w-[60%] h-[75%] border-2 border-dashed rounded-[40%] transition-colors duration-300 ${
                  statusText.includes("Too dark") ||
                  statusText.includes("No face")
                    ? "border-red-400/70"
                    : "border-green-400/50"
                }`}
              ></div>
            </div>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <StepProgress
        currentStep={currentStepId}
        capturedCount={capturedImages.length}
      />
    </div>
  );
}
