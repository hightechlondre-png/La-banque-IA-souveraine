import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Upload, FileText, Search, Trash2, FileJson } from "lucide-react";

export default function DocumentIndexer() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [notionUrl, setNotionUrl] = useState("");

  const { data: documents = [] } = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: () => base44.entities.KnowledgeDocument.list("-indexed_at", 100),
    refetchInterval: 5000,
  });

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Upload file to storage
      const fileData = await selectedFile.arrayBuffer();
      const uploadedFile = await base44.integrations.Core.UploadFile({
        file: new Blob([fileData], { type: selectedFile.type }),
      });

      // For PDF, extract text (simplified - in production use pdf.js)
      let extractedText = "";
      if (selectedFile.type === "application/pdf") {
        // Simulate PDF extraction - in production use pdf-parse or similar
        extractedText = `PDF Content from ${selectedFile.name}:\n\n[PDF content would be extracted here with proper PDF parsing library]`;
      } else if (selectedFile.type === "text/plain") {
        extractedText = await selectedFile.text();
      }

      // Index document
      const response = await base44.functions.invoke("indexDocument", {
        title: selectedFile.name,
        source_type: "pdf",
        content: extractedText || `Document: ${selectedFile.name}`,
        file_url: uploadedFile.file_url,
        metadata: {
          original_name: selectedFile.name,
          size_bytes: selectedFile.size,
        },
      });

      setFile(null);
      document.getElementById("file-input").value = "";
    } catch (err) {
      console.error("Upload error:", err);
    }
    setUploading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);

    try {
      const response = await base44.functions.invoke("retrieveContext", {
        query: searchQuery,
        top_k: 5,
      });
      setSearchResults(response.data.results || []);
    } catch (err) {
      console.error("Search error:", err);
    }
    setSearching(false);
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await base44.entities.KnowledgeDocument.delete(docId);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const totalChunks = documents.reduce((s, d) => s + (d.chunk_count || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          Indexeur de Base de Connaissances
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Indexez des PDFs et documents Notion pour que les agents IA y accèdent via RAG
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Documents indexés", value: documents.length, icon: "📄" },
          { label: "Chunks totaux", value: totalChunks, icon: "📦" },
          { label: "Espaces mémoire", value: documents.filter((d) => d.is_indexed).length, icon: "✓" },
          { label: "Taille DB", value: `${(totalChunks * 0.5).toFixed(1)} MB`, icon: "💾" },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-lg mb-1">{k.icon}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-lg font-bold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Upload section */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Télécharger des Documents</h3>
          </div>

          {/* File upload */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-2">
              PDF ou Texte
            </label>
            <input
              id="file-input"
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full text-sm"
            />
          </div>

          <Button
            onClick={() => document.getElementById("file-input")?.click()}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Indexation...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Sélectionner fichier
              </>
            )}
          </Button>

          {/* Notion section */}
          <div className="h-px bg-border" />
          <div>
            <label className="text-xs font-semibold text-foreground block mb-2">
              Lien Notion (bêta)
            </label>
            <input
              type="text"
              value={notionUrl}
              onChange={(e) => setNotionUrl(e.target.value)}
              placeholder="https://notion.so/..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Connecteur Notion bientôt disponible
            </p>
          </div>
        </div>

        {/* Search section */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Rechercher dans la Base</h3>
          </div>

          <textarea
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Posez une question ou cherchez un concept..."
            className="w-full h-20 px-3 py-2 text-xs rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary"
          />

          <Button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="w-full"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Recherche...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Chercher
              </>
            )}
          </Button>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-semibold">
                {searchResults.length} résultats
              </p>
              {searchResults.map((result, i) => (
                <div key={i} className="bg-secondary/40 rounded-lg p-2.5 border border-border/30">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[10px] font-mono text-foreground">
                      {result.document_title}
                    </p>
                    <span className="text-[9px] text-primary font-bold">
                      {(result.similarity * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground line-clamp-2">
                    {result.text.substring(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents list */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-chart-2" />
            <h3 className="text-sm font-bold text-foreground">Documents ({documents.length})</h3>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucun document indexé
              </p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-secondary/40 rounded-lg p-3 border border-border/30 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {doc.title}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[8px] mt-1"
                      >
                        {doc.chunk_count || 0} chunks
                      </Badge>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(doc.created_date).toLocaleDateString("fr-FR")}
                  </p>
                  <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(100, (doc.chunk_count || 0) * 5)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
        <div className="flex gap-3">
          <FileJson className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-foreground space-y-1">
            <p className="font-semibold">Comment ça marche</p>
            <p className="text-muted-foreground">
              Les documents sont découpés en chunks, transformés en embeddings et stockés en base.
              Quand un agent pose une question, on récupère les chunks les plus similaires
              (via similarité cosinus) pour enrichir son contexte. Les agents peuvent ainsi
              consulter vos connaissances privées sans accès internet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}