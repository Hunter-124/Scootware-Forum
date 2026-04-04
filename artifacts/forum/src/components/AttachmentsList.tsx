import React from "react";
import { Download, Trash2, File, FileText, FileCode, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface Attachment {
  id: number;
  filename: string;
  originalFilename: string;
  filesize: number;
  mimeType: string;
  filePath: string;
  uploadedByUsername?: string;
  uploadedAt: string;
}

interface AttachmentsListProps {
  attachments: Attachment[];
  onDelete?: (attachmentId: number) => void;
  isDeleting?: boolean;
  canDelete?: boolean;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <FileText className="w-4 h-4" />;
  if (mimeType.includes("pdf")) return <FileText className="w-4 h-4" />;
  if (mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("text")) return <FileCode className="w-4 h-4" />;
  if (mimeType.includes("zip") || mimeType.includes("archive")) return <FileArchive className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function AttachmentsList({
  attachments,
  onDelete,
  isDeleting = false,
  canDelete = false,
}: AttachmentsListProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Attachments ({attachments.length})
      </h4>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="glass-panel p-3 rounded-lg border border-white/5 flex items-center justify-between gap-3 hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="text-primary shrink-0">
                {getFileIcon(attachment.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <a
                  href={attachment.filePath}
                  download={attachment.originalFilename}
                  className="text-sm text-white hover:text-primary transition-colors truncate font-medium"
                  title={attachment.originalFilename}
                >
                  {attachment.originalFilename}
                </a>
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(Number(attachment.filesize))} • {formatDate(attachment.uploadedAt)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={attachment.filePath}
                download={attachment.originalFilename}
                className="p-1 hover:bg-primary/20 rounded transition-colors text-primary"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
              {canDelete && onDelete && (
                <button
                  onClick={() => onDelete(attachment.id)}
                  disabled={isDeleting}
                  className="p-1 hover:bg-destructive/20 rounded transition-colors text-destructive disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
