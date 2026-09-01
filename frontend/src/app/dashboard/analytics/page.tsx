"use client"
import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/src/lib/api'
import { 
  Activity, 
  ShieldAlert, 
  BookCheck,
  Users,
  GraduationCap, 
  Building2, 
  BarChart3, 
  AlertTriangle,
  RefreshCcw,
  Calendar,
  TriangleAlert
} from 'lucide-react'
import ViolationDistributionChart from '@/src/components/analytics/ViolationDistributionChart'
import ActivityTrendChart from '@/src/components/analytics/ActivityTrendChart'
import TopViolatorsList from '@/src/components/analytics/TopViolatorsList'

interface AnalyticsData {
  overview: {
    total_institutions: number;
    total_exams: number;
    total_students: number;
    total_violations: number;
  };
  violation_distribution: Array<{ violation_type: string; count: number }>;
  violation_trend: Array<{ date: string; count: number }>;
  session_trend: Array<{ date: string; count: number }>;
  top_violators: Array<{ name: string; violation_count: number }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true);
      const res = await apiFetch("/analytics/dashboard");
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin text-blue-600">
          <RefreshCcw size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">System Analytics</h1>
          <p className="text-slate-500">Comprehensive overview of examination integrity and activity.</p>
        </div>
        <button 
          onClick={fetchAnalytics}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCcw size={18} className={refreshing ? "animate-spin" : ""} />
          Refresh Data
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Institutions" 
          value={data?.overview.total_institutions ?? 0} 
         
        />
        <StatCard 
          title="Total Exams" 
          value={data?.overview.total_exams ?? 0} 
         
        />
        <StatCard 
          title="Total Students" 
          value={data?.overview.total_students ?? 0} 
          
        />
        <StatCard 
          title="Security Violations" 
          value={data?.overview.total_violations ?? 0} 
          isAlert
          showPing={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Violation Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 ">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              {/* <Activity size={20} className="text-blue-600" /> */}
              Violation Trends
            </h3>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-full">
              <Calendar size={14} />
              Last 30 Days
            </div>
          </div>
          <ActivityTrendChart data={data?.violation_trend ?? []} label="Violations" color="#ef4444" />
        </div>

        {/* Violation Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 ">
          <h3 className="font-bold text-slate-900 text-lg mb-8 flex items-center gap-2">
            {/* <ShieldAlert size={20} className="text-red-500" /> */}
            Violation Types
          </h3>
          <ViolationDistributionChart data={data?.violation_distribution ?? []} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Session Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 ">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              {/* <BarChart3 size={20} className="text-emerald-600" /> */}
              Exam Activity
            </h3>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-full">
              <Calendar size={14} />
              Last 30 Days
            </div>
          </div>
          <ActivityTrendChart data={data?.session_trend ?? []} label="Sessions" color="#10b981" />
        </div>

        {/* Top Violators */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 ">
          <h3 className="font-bold text-slate-900 text-lg mb-6 flex items-center gap-2">
            {/* <AlertTriangle size={20} className="text-amber-500" /> */}
            Most Violations
          </h3>
          <TopViolatorsList data={data?.top_violators ?? []} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, isAlert = false, showPing = true }: { 
  title: string, 
  value: number, 
  // icon: React.ReactNode, 
  // color: 'blue' | 'purple' | 'emerald' | 'red',
  isAlert?: boolean,
  showPing?: boolean,
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className={`bg-white p-6 rounded-2xl border ${isAlert ? 'border-red-100' : 'border-slate-200'} relative overflow-hidden group transition-all`}>
      <div className="flex justify-between items-start">
        <div className="w-10 h-10 rounded-xl transition-colors" />
        {isAlert && value > 0 && showPing && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
      </div>
      <p className="-mt-2 text-3xl text-slate-900 font-bold mb-1 tracking-tight">
        {value.toLocaleString()}
      </p>
      <h3 className="font-medium text-slate-500 text-sm">{title}</h3>
      
      {/* Decorative background element */}
      {/* decorative background removed */}
    </div>
  );
}
