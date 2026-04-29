"use client"
import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Building2, 
  BookOpen, 
  FileText, 
  Users, 
  Settings, 
  LogOut,
  ShieldCheck
} from 'lucide-react'
import { apiFetch } from '@/src/lib/api'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Institutions', href: '/dashboard/institutions', icon: Building2 },
  { name: 'Subjects', href: '/dashboard/subjects', icon: BookOpen },
  { name: 'Exams', href: '/dashboard/exams', icon: FileText },
  { name: 'Students', href: '/dashboard/students', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch (e) {
      console.error(e)
    }
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col h-full border-r border-slate-800 shrink-0 shadow-2xl">
      {/* Brand area */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-white font-bold tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <span>ExamGuard</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">
          Workspace
        </div>
        
        {navItems.map((item) => {
          const Icon = item.icon
          // Highlight if strictly equal for dashboard, or starts with for subroutes
          const isActive = item.href === '/dashboard' 
            ? pathname === item.href 
            : pathname.startsWith(item.href)

          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 group ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon 
                size={18} 
                className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} 
              />
              {item.name}
            </Link>
          )
        })}
      </div>

      {/* Bottom Profile / Logout */}
      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  )
}
