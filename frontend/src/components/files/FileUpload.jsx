import { useRef, useState } from 'react'
import axios from 'axios'
import { getToken } from '@/api/base44Client'
import { Upload, Loader2, X, FileText, ImageIcon, FileVideo, FileAudio, File as FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

const MAX_MB = 25

function iconFor(mime) {
  if (!mime) return FileIcon
  if (mime.startsWith('image/')) return ImageIcon
  if (mime.startsWith('video/')) return FileVideo
  if (mime.startsWith('audio/')) return FileAudio
  if (mime.startsWith('text/') || mime === 'application/pdf' || mime === 'application/json') return FileText
  return FileIcon
}

function fmtSize(n) {
  if (n == null) return ''
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

/**
 * Réutilisable : upload un fichier via /api/files/upload.
 * Props: purpose (string, default 'generic'), accept (string), onUploaded(file), className.
 */
export default function FileUpload({ purpose = 'generic', accept, onUploaded, className = '', label }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [uploaded, setUploaded] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const pick = () => inputRef.current?.click()

  const validate = (f) => {
    if (!f) return 'Aucun fichier'
    if (f.size > MAX_MB * 1024 * 1024) return `Fichier trop volumineux (max ${MAX_MB} MB)`
    return null
  }

  const handleFile = (f) => {
    setError(null)
    setUploaded(null)
    const err = validate(f)
    if (err) {
      setError(err)
      return
    }
    setFile(f)
  }

  const upload = async () => {
    if (!file) return
    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await axios.post(
        `${BACKEND}/api/files/upload?purpose=${encodeURIComponent(purpose)}`,
        form,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 120000,
          onUploadProgress: (e) => {
            if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
          },
        },
      )
      setUploaded(res.data)
      setFile(null)
      setProgress(0)
      if (onUploaded) onUploaded(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setError(null)
    setProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const Icon = iconFor(file?.type || uploaded?.content_type)

  return (
    <div data-testid="file-upload" className={cn('w-full', className)}>
      <input
        ref={inputRef}
        data-testid="file-upload-input"
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!file && !uploaded && (
        <button
          type="button"
          data-testid="file-upload-dropzone"
          onClick={pick}
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          className={cn(
            'w-full rounded-xl border-2 border-dashed transition-colors p-6 text-center',
            'flex flex-col items-center gap-2',
            dragActive
              ? 'border-primary/60 bg-primary/5'
              : 'border-border hover:border-primary/40 hover:bg-secondary/30',
          )}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            {label || 'Cliquer ou glisser un fichier ici'}
          </p>
          <p className="text-[11px] font-mono text-muted-foreground">
            Max {MAX_MB} MB · images, vidéos, PDFs, JSON, texte
          </p>
        </button>
      )}

      {file && !uploaded && (
        <div className="rounded-xl border border-border p-3 bg-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
              <p className="text-[11px] font-mono text-muted-foreground">
                {fmtSize(file.size)} · {file.type || 'inconnu'}
              </p>
            </div>
            {!uploading && (
              <button
                type="button"
                data-testid="file-upload-reset-btn"
                onClick={reset}
                className="p-1.5 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                aria-label="Retirer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {uploading && (
            <div className="mt-3">
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                Upload {progress}%
              </p>
            </div>
          )}
          {!uploading && (
            <Button
              data-testid="file-upload-submit-btn"
              onClick={upload}
              size="sm"
              className="w-full mt-3 gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Uploader
            </Button>
          )}
        </div>
      )}

      {uploaded && (
        <div
          data-testid="file-upload-success"
          className="rounded-xl border border-green-500/30 bg-green-500/5 p-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/15 border border-green-500/30 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {uploaded.original_filename}
              </p>
              <p className="text-[11px] font-mono text-green-400">
                ✓ Uploadé · {fmtSize(uploaded.size)}
              </p>
            </div>
            <Button
              data-testid="file-upload-reset-after-btn"
              variant="ghost"
              size="sm"
              onClick={() => { setUploaded(null); reset() }}
            >
              Nouveau
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p data-testid="file-upload-error" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
