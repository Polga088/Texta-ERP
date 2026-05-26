"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Download, FileSpreadsheet, FileText, Image, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DocumentFile } from "@/types";
import { cn } from "@/lib/utils";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function FileUpload({
  entityType,
  entityId,
  className,
}: {
  entityType: "lead" | "project" | "task" | "quote" | "invoice" | "client";
  entityId: string;
  className?: string;
}) {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const authHeaders = useMemo(() => {
    if (typeof window === "undefined") return {};
    const token = window.localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadFiles = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/documents/entity/${entityType}/${entityId}`, { headers: authHeaders });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Impossible de charger les documents");
      }
      const rows = (await response.json()) as DocumentFile[];
      setFiles(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur chargement documents");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, entityId, entityType]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setUploading(true);
      try {
        for (const file of acceptedFiles) {
          if (file.size > MAX_SIZE_BYTES) {
            toast.error(`${file.name} dépasse 10 Mo`);
            continue;
          }
          const formData = new FormData();
          formData.append("file", file);
          formData.append("entity_type", entityType);
          formData.append("entity_id", entityId);
          const response = await fetch("/api/v1/documents/upload", {
            method: "POST",
            headers: authHeaders,
            body: formData,
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.detail || `Upload impossible pour ${file.name}`);
          }
          const row = (await response.json()) as DocumentFile;
          setFiles((current) => [row, ...current]);
          toast.success(`${file.name} uploadé`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur upload");
      } finally {
        setUploading(false);
      }
    },
    [authHeaders, entityId, entityType],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_SIZE_BYTES,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/plain": [".txt"],
    },
  });

  const handleDelete = async (documentId: string) => {
    const response = await fetch(`/api/v1/documents/${documentId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      toast.error(payload?.detail || "Suppression impossible");
      return;
    }
    setFiles((current) => current.filter((file) => file.id !== documentId));
    toast.success("Document supprimé");
  };

  const iconForMime = (mimeType?: string) => {
    if ((mimeType || "").startsWith("image/")) return Image;
    if ((mimeType || "").includes("sheet") || (mimeType || "").includes("excel")) return FileSpreadsheet;
    return FileText;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors",
          isDragActive
            ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
            : "border-slate-300 hover:border-slate-400 dark:border-slate-700",
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-violet-500" />
        ) : (
          <>
            <Upload className="mx-auto mb-2 h-7 w-7 text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isDragActive ? "Déposez les fichiers ici" : "Glissez-déposez ou cliquez pour sélectionner"}
            </p>
            <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPG, DOC, DOCX, XLS, XLSX, TXT (max 10 Mo)</p>
          </>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Chargement des documents…</div>
      ) : files.length === 0 ? (
        <div className="text-sm text-slate-500">Aucun document.</div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const Icon = iconForMime(file.mime_type);
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <Icon size={16} className="text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.original_filename}</p>
                  <p className="text-xs text-slate-500">{formatSize(file.file_size)}</p>
                </div>
                <a
                  href={`/api/v1/documents/download/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                  aria-label="Télécharger"
                >
                  <Download size={16} />
                </a>
                <button
                  onClick={() => void handleDelete(file.id)}
                  className="rounded-lg p-2 text-rose-600 transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/30"
                  aria-label="Supprimer"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
