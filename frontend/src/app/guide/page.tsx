"use client";
import React, { useState } from "react";
import Header from "../../components/ui/header";
import Footer from "../../components/ui/footer";
import { ChevronRight, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function GuidePage() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: "1. Account Registration",
      subtitle: "Sign up and log in as an Examiner",
      description:
        "Get started by creating a secure examiner profile to manage assessments and oversee candidates.",
      details: [
        "Navigate to the landing page and click 'Get Started' or 'Sign Up'.",
        "Fill in your name, academic email address, and a secure password.",
        "Verify your account via the automated confirmation link sent to your email.",
        "Sign in using your credentials to access the central Examiner Dashboard.",
      ],
    },
    {
      title: "2. Setting Up a Subject",
      subtitle: "Organize exams under academic subjects",
      description:
        "Before creating examinations, set up subjects (e.g., Math, Computer) to categorize assessments.",
      details: [
        "From the dashboard sidebar, select the 'Subjects' section.",
        "Click the '+ Create Subject' button in the upper-right corner.",
        "Enter the official Subject Name, Subject Code, and a brief description.",
        "Click 'Create' to establish the subject bounds in the database.",
      ],
    },
    {
      title: "3. Creating an Examination",
      subtitle: "Configure parameters, questions, and timing gates",
      description:
        "Build the exam structure, input the question bank, and enforce strict security configurations.",
      details: [
        "Go to the 'Exams' page and click 'New Examination'.",
        "Specify the Exam Title, Duration (in minutes), and set the official Start/End window.",
        "Toggle security controls such as 'Shuffle Questions', 'Shuffle Options'.",
        "Input questions, define options, and check the box next to correct options to configure the MCQ autograder.",
        "Click 'Publish Exam' to lock the timing boundaries on the backend.",
      ],
    },
    {
      title: "4. Pre-enrolling Students",
      subtitle: "Authorize candidates for the exam seat",
      description:
        "Enforce multi-tenant security by restricting exam entry only to pre-registered candidates.",
      details: [
        "Within the exam detail page, locate the 'Enrolled Candidates' section.",
        "Click 'Pre-enroll Students' to pre-enroll students",
        "Provide each candidate's First Name, Last Name, Email, and Student ID.",
        "The system registers the students under a 'pending' state.",
      ],
    },
    {
      title: "5. Dispatching Enrollment Links",
      subtitle: "Enforce student biometric template registration",
      description:
        "Students must enroll their biometric profiles before exam day.",
      details: [
        "Click 'Send Enrollment Invites' to automatically dispatch email links to pre-enrolled candidates.",
        "Alternatively, copy the unique tokenized single-use enrollment URLs manually from the dashboard list.",
        "Ensure students complete their 5-photo biometric scan.",
        "Verify candidate status transitions from 'pending' to 'enrolled' in your active list.",
      ],
    },
    {
      title: "6. Real-Time Live Monitoring",
      subtitle: "Oversee candidates via the proctoring stream",
      description:
        "Track live browser visibility events and biometric matching results as the exam takes place.",
      details: [
        "On exam day, open the specific exam from your dashboard.",
        "This launches the proctoring panel, showing a grid of active candidate cards.",
        "Students are constantly checked. Any mismatch, tab switch, or focus loss triggers an alert.",
        "Violations are highlighted with red border alerts, logging webcam snapshots and event timestamps immediately.",
      ],
    },
    {
      title: "7. Auditing & Autograding",
      subtitle: "Review violation logs and export reports",
      description:
        "Audit grades, investigate flagged events, and finalize examination results.",
      details: [
        "Upon exam completion, the Celery autograder scores all submitted sheets automatically.",
        "Click on any student card to review their timeline, logged violations, and raw webcam snapshots.",
        "Apply grade adjustments or overrides if flagged violations were deemed false-positives.",
        "Click 'Send Result' to publish the results to each students' email",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-grotesk">
      {/* Header wrapper */}
      <div className="bg-[#0a0f1e]">
        <Header />
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12">
        {/* Banner Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Examiner Navigation Guide
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Follow this step-by-step guide to set up subjects, configure
            examinations, pre-enroll candidates, run real-time proctoring, and
            review results.
          </p>
        </div>

        {/* Tab/Sidebar Content Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Steps Navigation Sidebar */}
          <div className="lg:col-span-4 border border-slate-200 p-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">
              Workflow Steps
            </h3>
            {steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all duration-200 text-left border ${
                  activeStep === idx
                    ? "bg-blue-600 border-blue-600 text-white font-medium"
                    : "bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors duration-200 ${
                    activeStep === idx
                      ? "bg-white text-blue-600 shadow-sm"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-semibold">
                    {step.title.split(". ")[1]}
                  </p>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${
                    activeStep === idx
                      ? "transform translate-x-1 opacity-100"
                      : "opacity-0"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Active Step Details Section */}
          <div className="lg:col-span-8 border border-slate-200 p-8 min-h-[500px] flex flex-col justify-between">
            <div className="space-y-6">
              {/* Step Title Header */}
              <div className="flex items-start gap-4 border-b border-slate-100 pb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {steps[activeStep].title}
                  </h2>
                  <p className="text-gray-400 font-medium text-sm mt-0.5">
                    {steps[activeStep].subtitle}
                  </p>
                </div>
              </div>

              {/* Step Description */}
              <p className="text-slate-600 text-base leading-relaxed italic">
                &apos;{steps[activeStep].description}&apos;
              </p>

              {/* Step Interactive Actions checklist */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Action Steps Checklist
                </h4>
                {steps[activeStep].details.map((detail, dIdx) => (
                  <div
                    key={dIdx}
                    className="flex gap-3 items-start p-3 bg-slate-50 border border-slate-100 rounded-xl transition-all hover:bg-slate-100/50"
                  >
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold shrink-0 mt-0.5 border border-blue-100">
                      {dIdx + 1}
                    </span>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Navigation controls inside card */}
            <div className="flex justify-between items-center border-t border-slate-100 pt-6 mt-8">
              <button
                onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                disabled={activeStep === 0}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 font-medium rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Previous Step
              </button>

              {activeStep < steps.length - 1 ? (
                <button
                  onClick={() =>
                    setActiveStep((prev) =>
                      Math.min(steps.length - 1, prev + 1),
                    )
                  }
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-100"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  href="/"
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-green-100"
                >
                  Go to Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
