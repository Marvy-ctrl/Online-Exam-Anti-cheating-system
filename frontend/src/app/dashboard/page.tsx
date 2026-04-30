"use client"
import React, { useEffect, useState } from 'react'
import { Activity, ShieldAlert, GraduationCap, Building2 } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'

interface DashboardOverview {
  institutions_count: number;
  active_exams_count: number;
  total_students_count: number;
  violations_detected_count: number;
}

export default function Dashboard() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await apiFetch("/institutions/dashboard/overview");
        if (res.ok) {
          const data = await res.json();
          setOverview(data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard overview:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Workspace Overview</h1>
        <p className="text-slate-500">Manage your zero-trust examination environment.</p>
      </div>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 size={20} />
            </div>
          </div>
          <p className="text-3xl text-slate-900 font-bold mb-1">
            {loading ? "..." : overview?.institutions_count ?? 0}
          </p>
          <h3 className="font-medium text-slate-500 text-sm">Institutions</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <Activity size={20} />
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>
          <p className="text-3xl text-slate-900 font-bold mb-1">
            {loading ? "..." : overview?.active_exams_count ?? 0}
          </p>
          <h3 className="font-medium text-slate-500 text-sm">Active Exams</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <GraduationCap size={20} />
            </div>
          </div>
          <p className="text-3xl text-slate-900 font-bold mb-1">
            {loading ? "..." : overview?.total_students_count ?? 0}
          </p>
          <h3 className="font-medium text-slate-500 text-sm">Total Students</h3>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <ShieldAlert size={20} />
            </div>
          </div>
          <p className="text-3xl text-slate-900 font-bold mb-1 relative z-10">
            {loading ? "..." : overview?.violations_detected_count ?? 0}
          </p>
          <h3 className="font-medium text-slate-500 text-sm relative z-10">Violations Detected</h3>
        </div>
      </div>

      {/* Recent Activity */}
      <h2 className="text-xl font-bold text-slate-900 mb-6">Recent Activity</h2>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No recent activity found. Start by creating an institution!</p>
      </div>
    </div>
  )
}
