import { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '@/api/base44Client'
import {
  FolderOpen, Loader2, Trash2, Download, RefreshCw,
  ImageIcon, FileText, FileVideo, FileAudio, File as FileIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import FileUpload from '@/components/files/FileUpload'

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) ||
  ''

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

export default function FilesPage() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const token = getToken()

  const load = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BACKEND}/api/files?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      })
      setFiles(res.data?.items || [])
    } catch (_) {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const remove = async (id) => {
    if (!confirm('Supprimer ce fichier ?')) return
    try {
      await axios.delete(`${BACKEND}/api/files/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setFiles((prev) => prev.filter((f) => f.id !== id))
    } catch (e) {
      alert('Erreur suppression : ' + (e?.response?.data?.detail || e?.message))
    }
  }

  const downloadUrl = (id) => `${BACKEND}/api/files/${id}/download?auth=${encodeURIComponent(token)}`

  return (
    <div data-testid="files-page" className="space-y-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Fichiers
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Espace de stockage Emergent Object Storage — chiffrement au repos, accès signé.
          </p>
        </div>
        <Button
          data-testid="files-refresh-btn"
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualiser
        </Button>
      </header>

      {/* Uploader */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-[10px] font-mono text-primary tracking-widest uppercase mb-3">
          Uploader un nouveau fichier
        </p>
        <FileUpload
          purpose="user_files"
          onUploaded={(f) => setFiles((prev) => [f, ...prev])}
          label="Cliquer ou glisser un fichier ici"
        />
      </div>

      {/* Gallery */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
            Mes fichiers · {files.length}
          </p>
        </div>
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : files.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Aucun fichier — utilise l&apos;uploader ci-dessus pour commencer.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((f) => {
              const Icon = iconFor(f.content_type)
              const isImage = (f.content_type || '').startsWith('image/')
              return (
                <div
                  key={f.id}
                  data-testid={`file-card-${f.id}`}
                  className="rounded-lg border border-border bg-secondary/20 hover:border-primary/30 transition-colors overflow-hidden group"
                >
                  {isImage ? (
                    <div className="aspect-video bg-black/40 overflow-hidden flex items-center justify-center">
                      <img
                        src={downloadUrl(f.id)}
                        alt={f.original_filename}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-black/40 flex items-center justify-center">
                      <Icon className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-xs font-semibold text-foreground truncate" title={f.original_filename}>
                      {f.original_filename}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">
                      {fmtSize(f.size)} · {(f.content_type || '').split(';')[0]}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <a
                        data-testid={`file-download-${f.id}`}
                        href={downloadUrl(f.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold',
                          'py-1.5 rounded-md bg-secondary hover:bg-secondary/60 border border-border transition-colors',
                        )}
                      >
                        <Download className="h-3 w-3" /> Voir
                      </a>
                      <button
                        data-testid={`file-delete-${f.id}`}
                        onClick={() => remove(f.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
