"use client"
import React, { useEffect, useState } from 'react'
import { Activity, ShieldAlert, GraduationCap, Building2, CheckCircle2, PlayCircle, TriangleAlert, Users } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'

interface ActivityItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

interface DashboardOverview {
  institutions_count: number;
  active_exams_count: number;
  total_students_count: number;
  violations_detected_count: number;
  recent_activities: ActivityItem[];
}

function formatRelativeTime(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 transition-shadow">
          <div className="flex justify-between items-start mb-4">
           
          </div>
          <p className="text-3xl text-slate-900 font-bold mb-1">
            {loading ? "..." : overview?.institutions_count ?? 0}
          </p>
          <h3 className="font-medium text-slate-500 text-sm">Institutions</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200  transition-shadow">
         
          <p className="text-3xl text-slate-900 font-bold mb-1">
            {loading ? "..." : overview?.active_exams_count ?? 0}
          </p>
          <h3 className="font-medium text-slate-500 text-sm">Active Exams</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200  transition-shadow">
          <div className="flex justify-between items-start mb-4">
         
          </div>
          <p className="text-3xl text-slate-900 font-bold mb-1">
            {loading ? "..." : overview?.total_students_count ?? 0}
          </p>
          <h3 className="font-medium text-slate-500 text-sm">Total Students</h3>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-red-100 transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
          
          </div>
          <p className="text-3xl text-slate-900 font-bold mb-1 relative z-10">
            {loading ? "..." : overview?.violations_detected_count ?? 0}
          </p>
          <h3 className="font-medium text-slate-500 text-sm relative z-10">Violations Detected</h3>
        </div>
      </div>

      {/* Recent Activity */}
      <h2 className="text-xl font-bold text-slate-900 mb-6">Recent Activity</h2>
      
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500 animate-pulse">Loading recent activity...</p>
        </div>
      ) : !overview?.recent_activities || overview.recent_activities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500">No recent activity found. Start by creating an institution!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {overview.recent_activities.map((activity, idx) => {
            let Icon = Activity;
            let iconBg = "bg-slate-50 text-slate-600";
            
            if (activity.type === 'violation') {
              Icon = ShieldAlert;
              iconBg = "bg-red-50 text-red-600";
            } else if (activity.type === 'submission') {
              Icon = CheckCircle2;
              iconBg = "bg-green-50 text-green-600";
            } else if (activity.type === 'session_start') {
              Icon = PlayCircle;
              iconBg = "bg-blue-50 text-blue-600";
            } else if (activity.type === 'institution') {
              Icon = Building2;
              iconBg = "bg-purple-50 text-purple-600";
            }

            return (
              <div key={idx} className="flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${iconBg}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm leading-snug">{activity.title}</h4>
                    <p className="text-slate-500 text-xs mt-0.5">{activity.description}</p>
                  </div>
                </div>
                <span className="text-slate-400 text-xs font-medium whitespace-nowrap">
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )
}
