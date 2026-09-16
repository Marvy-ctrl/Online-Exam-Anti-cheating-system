import type { ReactNode } from 'react'
import { AlertTriangle, EyeOff, Fingerprint, Monitor, Shuffle, Users } from 'lucide-react'
import type { ViolationSeverity } from '@/src/types/session-audit'

export interface ViolationConfig {
  label: string
  icon: ReactNode
  textColor: string
  bgColor: string
  borderColor: string
  badgeBg: string
  badgeText: string
  severity: ViolationSeverity
}

const CONFIG: Record<string, ViolationConfig> = {
  no_face: { label: 'No Face Detected', icon: <EyeOff size={14} />, textColor: 'text-orange-600', bgColor: 'bg-white', borderColor: 'border-red-200', badgeBg: 'bg-red-100', badgeText: 'text-red-700', severity: 'high' },
  multiple_faces: { label: 'Multiple Faces', icon: <Users size={14} />, textColor: 'text-red-600', bgColor: 'bg-white', borderColor: 'border-red-200', badgeBg: 'bg-red-100', badgeText: 'text-red-700', severity: 'critical' },
  face_mismatch: { label: 'Face Mismatch', icon: <Fingerprint size={14} />, textColor: 'text-rose-600', bgColor: 'bg-white', borderColor: 'border-red-200', badgeBg: 'bg-rose-100', badgeText: 'text-rose-700', severity: 'critical' },
  tab_switch: { label: 'Tab Switching', icon: <Shuffle size={14} />, textColor: 'text-yellow-700', bgColor: 'bg-white', borderColor: 'border-red-200', badgeBg: 'bg-yellow-100', badgeText: 'text-yellow-800', severity: 'medium' },
  focus_loss: { label: 'Focus Lost', icon: <Monitor size={14} />, textColor: 'text-amber-700', bgColor: 'bg-white', borderColor: 'border-red-200', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800', severity: 'medium' },
}

export const SEVERITY_BADGE: Record<ViolationSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
}

export function getViolationConfig(type: string): ViolationConfig {
  return CONFIG[type] ?? { label: type, icon: <AlertTriangle size={14} />, textColor: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', badgeBg: 'bg-red-100', badgeText: 'text-red-700', severity: 'high' }
}
