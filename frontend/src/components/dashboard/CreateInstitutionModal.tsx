"use client"
import React, { useRef, useState } from 'react'
import { apiFetch } from '@/src/lib/api'
import { X, Upload, Building2, ImageIcon } from 'lucide-react'

interface CreateInstitutionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateInstitutionModal({ isOpen, onClose, onSuccess }: CreateInstitutionModalProps) {
  const [name, setName] = useState('')
  const [shortInfo, setShortInfo] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side guard — backend enforces this too
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      setLogoError('Only JPEG, PNG, WebP and SVG files are allowed.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo must be smaller than 2 MB.')
      return
    }

    setLogoError(null)
    setLogoPreview(URL.createObjectURL(file))
    setLogoUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await apiFetch('/institutions/upload-logo', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Upload failed')
      }

      const data = await res.json()
      setLogoUrl(data.logo_url)
    } catch (err: unknown) {
      setLogoPreview(null)
      setLogoUrl(null)
      setLogoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  const clearLogo = () => {
    setLogoUrl(null)
    setLogoPreview(null)
    setLogoError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await apiFetch('/institutions/create', {
        method: 'POST',
        body: JSON.stringify({
          name,
          short_info: shortInfo || null,
          logo_url: logoUrl || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to create institution')
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-2">Deploy Workspace</h2>
        <p className="text-sm text-slate-500 mb-6">Create a new dedicated institution workspace.</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Institution Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Institution Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stanford University"
              required
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Short Description (Optional)</label>
            <textarea
              value={shortInfo}
              onChange={(e) => setShortInfo(e.target.value)}
              placeholder="Main campus engineering department..."
              rows={2}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Institution Logo (Optional)</label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              id="logo-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={handleLogoSelect}
              className="hidden"
            />

            {logoPreview ? (
              /* Preview state */
              <div className="flex items-center gap-4 p-3 border border-slate-200 rounded-xl bg-slate-50">
                <div className="w-14 h-14 rounded-lg border border-slate-200 overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  {logoUploading ? (
                    <p className="text-sm text-blue-600 font-medium animate-pulse">Uploading…</p>
                  ) : logoUrl ? (
                    <p className="text-sm text-green-600 font-medium">✓ Logo uploaded</p>
                  ) : null}
                  <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WebP or SVG · max 2 MB</p>
                </div>
                <button
                  type="button"
                  onClick={clearLogo}
                  className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Remove logo"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              /* Drop zone / picker */
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
                className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                  <Upload size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Click to upload logo</p>
                  <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WebP or SVG · max 2 MB</p>
                </div>
              </button>
            )}

            {logoError && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <ImageIcon size={12} /> {logoError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || logoUploading}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? 'Creating…' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
