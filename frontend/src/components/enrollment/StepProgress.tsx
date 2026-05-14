"use client";

import React from "react";
import { CheckCircle } from "lucide-react";

export interface EnrollmentStep {
  id: number;
  label: string;
  instruction: string;
  icon: string;
}

export const ENROLLMENT_STEPS: EnrollmentStep[] = [
  { id: 1, label: "Front", instruction: "Look straight at the camera", icon: "😐" },
  { id: 2, label: "Turn Left", instruction: "Slowly turn your head left", icon: "👈" },
  { id: 3, label: "Turn Right", instruction: "Slowly turn your head right", icon: "👉" },
  { id: 4, label: "Chin Up", instruction: "Tilt your chin slightly upward", icon: "🆙" },
  { id: 5, label: "Smile", instruction: "Give a natural smile", icon: "😊" },
];

interface StepProgressProps {
  currentStep: number; // 1-based; 0 = not started, 6 = all done
  capturedCount: number;
}

export function StepProgress({ currentStep, capturedCount }: StepProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      {ENROLLMENT_STEPS.map((step) => {
        const isDone = capturedCount >= step.id;
        const isActive = currentStep === step.id;

        return (
          <div key={step.id} className="flex flex-col items-center gap-1">
            {/* Connector line */}
            <div className="flex items-center">
              {step.id > 1 && (
                <div
                  className={`h-0.5 w-6 transition-colors duration-500 ${
                    capturedCount >= step.id ? "bg-green-500" : "bg-slate-200"
                  }`}
                />
              )}
              {/* Circle */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 text-xs font-bold
                  ${isDone
                    ? "bg-green-500 text-white scale-110"
                    : isActive
                    ? "bg-blue-600 text-white ring-4 ring-blue-200 scale-110"
                    : "bg-slate-100 text-slate-400"
                  }`}
              >
                {isDone ? <CheckCircle size={18} /> : step.id}
              </div>
            </div>
            {/* Label */}
            <span
              className={`text-[10px] font-medium transition-colors ${
                isDone ? "text-green-600" : isActive ? "text-blue-600" : "text-slate-400"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
