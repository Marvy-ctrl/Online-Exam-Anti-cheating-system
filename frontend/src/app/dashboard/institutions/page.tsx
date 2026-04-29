"use client"
import React, { useEffect, useState } from 'react'
import { Plus, Building2, MapPin, ExternalLink, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/src/lib/api'
import Link from 'next/link'
import CreateInstitutionModal from '@/src/components/dashboard/CreateInstitutionModal'

interface Institution {
  uid: string
  name: string
  short_info: string | null
  logo_url: string | null
}

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadInstitutions = async () => {
    setLoading(true)
    try {
      const res = await apiFetch("/institutions")
      if (res.ok) {
        const data = await res.json()
        setInstitutions(data)
      }
    } catch (err) {
      console.error("Failed to load institutions:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInstitutions()
  }, [])

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Institutions</h1>
          <p className="text-slate-500">Manage your deployed educational workspaces.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          New Institution
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-400">Loading...</div>
      ) : institutions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-4">
            <Building2 size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No institutions yet</h3>
          <p className="text-slate-500 max-w-sm mb-6">Create your first institution to start managing your subjects, exams, and students in a dedicated workspace.</p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            Create your first Institution
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {institutions.map(inst => (
            <Link 
              href={`/dashboard/institutions/${inst.uid}`} 
              key={inst.uid}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group block relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                  {inst.logo_url ? (
                    <img src={inst.logo_url} alt={inst.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 size={24} className="text-blue-500" />
                  )}
                </div>
                <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <ChevronRight size={18} />
                </div>
              </div>
              
              <h3 className="font-bold text-lg text-slate-900 mb-1">{inst.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2">
                {inst.short_info || "No description provided."}
              </p>
            </Link>
          ))}
        </div>
      )}

      {isModalOpen && (
        <CreateInstitutionModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={loadInstitutions}
        />
      )}
    </div>
  )
}
