"use client"
import React from 'react'
import { User, AlertTriangle } from 'lucide-react'

interface TopViolatorItem {
  name: string;
  violation_count: number;
}

interface Props {
  data: TopViolatorItem[];
}

export default function TopViolatorsList({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 italic">
        <div className="p-3 bg-slate-100 rounded-full mb-3">
          <User size={24} />
        </div>
        <p>No violation history found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((violator, index) => (
        <div 
          key={index} 
          className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
              index === 0 ? 'bg-red-500' : index === 1 ? 'bg-orange-500' : 'bg-slate-400'
            }`}>
              {violator.name.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-slate-900">{violator.name}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Rank #{index + 1}</div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 text-red-600 font-bold">
              <AlertTriangle size={16} />
              <span>{violator.violation_count}</span>
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Violations</div>
          </div>
        </div>
      ))}
    </div>
  )
}
