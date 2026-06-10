"use client"
import React, { useEffect, useState } from 'react'
import { BookOpen, ChevronRight, Search, Building2 } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'
import Link from 'next/link'

interface Subject {
  uid: string
  name: string
  institution_uid: string
}

interface Institution {
  uid: string
  name: string
}

interface GroupedSubject {
  name: string
  institutions: Institution[]
}

export default function GlobalSubjectsPage() {
  const [groupedSubjects, setGroupedSubjects] = useState<GroupedSubject[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [subRes, instRes] = await Promise.all([
        apiFetch("/exam/subjects"),
        apiFetch("/institutions")
      ])
      
      if (subRes.ok && instRes.ok) {
        const subjectsData: Subject[] = await subRes.json()
        const institutionsData: Institution[] = await instRes.json()
        
        // Create lookup map for institutions
        const instMap = new Map(institutionsData.map(inst => [inst.uid, inst]))
        
        // Group subjects by name
        const groups = new Map<string, GroupedSubject>()
        
        subjectsData.forEach(sub => {
          const key = sub.name.toLowerCase()
          if (!groups.has(key)) {
            groups.set(key, { name: sub.name, institutions: [] })
          }
          
          const inst = instMap.get(sub.institution_uid)
          if (inst) {
            groups.get(key)!.institutions.push(inst)
          }
        })
        
        setGroupedSubjects(Array.from(groups.values()))
      }
    } catch (err) {
      console.error("Failed to load data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredSubjects = groupedSubjects.filter(sub => 
    sub.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">All Subjects</h1>
          <p className="text-slate-500">View and manage all subjects across your institutions.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
            placeholder="Search subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-400">Loading subjects...</div>
      ) : groupedSubjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-4">
            <BookOpen size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No subjects found</h3>
          <p className="text-slate-500 max-w-sm mb-6">You have not created any subjects yet. Go to an institution workspace to create your first subject.</p>
          <Link 
            href="/dashboard/institutions"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            Go to Institutions
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubjects.map(sub => (
            <Link 
              href={`/dashboard/subjects/${encodeURIComponent(sub.name)}`} 
              key={sub.name}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group block relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className=" flex items-center justify-center overflow-hidden">
                  <BookOpen size={24} className="text-blue-600" />
                </div>
                <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <ChevronRight size={18} />
                </div>
              </div>
              
              <h3 className="font-bold text-xl text-slate-900 mb-3">{sub.name}</h3>
              <div className="mt-auto pt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                  {/* <Building2 size={14} className="text-slate-400" /> */}
                  Offered in {sub.institutions.length} institution{sub.institutions.length !== 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          ))}
          {filteredSubjects.length === 0 && searchTerm && (
             <div className="col-span-full py-10 text-center text-slate-500">
               No subjects match your search `{searchTerm}``.
             </div>
          )}
        </div>
      )}
    </div>
  )
}
