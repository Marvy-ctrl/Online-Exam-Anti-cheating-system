"use client";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { FaceEnrollmentFlow, FaceEnrollmentSuccessData } from "@/src/components/enrollment/FaceEnrollmentFlow";

export default function FaceRegistrationPage() {
  const params = useParams();
  const enrollmentUid = params.uid as string;
  const [success, setSuccess] = useState(false);

  const handleSuccess = (data: FaceEnrollmentSuccessData) => {
    if (data.exam_uid) {
      // Track enrolled exams list
      const enrolledExams = JSON.parse(
        localStorage.getItem("enrolled_exams") || "[]",
      );
      if (!enrolledExams.includes(data.exam_uid)) {
        enrolledExams.push(data.exam_uid);
        localStorage.setItem("enrolled_exams", JSON.stringify(enrolledExams));
      }
      // Map exam_uid → enrollment_uid so the exam entry gate can find the student
      const enrolledMap = JSON.parse(
        localStorage.getItem("enrolled_exams_map") || "{}",
      );
      enrolledMap[data.exam_uid] = enrollmentUid;
      localStorage.setItem("enrolled_exams_map", JSON.stringify(enrolledMap));
    }
    setSuccess(true);
  };

  const handleError = (msg: string) => {
    // Optional: Log errors or do additional handling.
    // FaceEnrollmentFlow handles its own error display.
    console.error("Enrollment error:", msg);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
         
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Face Registration Complete
          </h1>
          <p className="text-slate-500 text-sm mb-6">
           Your facial profile has been successfully captured and securely stored. You are now ready to participate in examinations using ExamLoc identity verification system.
          </p>
          <p className="text-xs text-slate-400 mt-6">
            Wishing you good luck in your academics!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden p-6">
        <FaceEnrollmentFlow
          enrollmentUid={enrollmentUid}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </div>
    </div>
  );
}
