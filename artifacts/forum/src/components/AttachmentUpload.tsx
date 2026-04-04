import React, { useState, useRef } from "react";
import { Upload, X, Loader, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttachmentUploadProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
  error?: string;
  maxFiles?: number;
  maxSize?: number; // in bytes (legacy support, will be ignored if using per-type limits)
}

// File type limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
const MAX_TEXT_SIZE = 2 * 1024 * 1024; // 2MB for .cfg and .lua files
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

export function AttachmentUpload({
  onFilesSelected,
  isUploading = false,
  error,
  maxFiles = 5,
}: AttachmentUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const getFileSizeLimit = (file: File): number => {
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf(".")).toLowerCase();
    const isImage = IMAGE_EXTENSIONS.has(fileExt) || file.type.startsWith("image/");
    return isImage ? MAX_IMAGE_SIZE : MAX_TEXT_SIZE;
  };

  const processFiles = (files: File[]) => {
    const newErrors: { [key: string]: string } = {};
    const validFiles: File[] = [];

    for (const file of files) {
      const limit = getFileSizeLimit(file);
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf(".")).toLowerCase();
      const isImage = IMAGE_EXTENSIONS.has(fileExt) || file.type.startsWith("image/");
      
      if (file.size > limit) {
        const maxMB = isImage ? 10 : 2;
        newErrors[file.name] = `${isImage ? "Image" : "File"} too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max: ${maxMB}MB`;
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length + selectedFiles.length > maxFiles) {
      newErrors["_limit"] = `Maximum ${maxFiles} files allowed`;
      return;
    }

    const newFiles = [...selectedFiles, ...validFiles];
    setSelectedFiles(newFiles);
    setValidationErrors({});
    onFilesSelected(newFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setValidationErrors({});
    onFilesSelected(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-3">
      {/* Drag and drop area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragActive
            ? "border-primary/50 bg-primary/5"
            : error || Object.keys(validationErrors).length > 0
              ? "border-destructive/50 bg-destructive/5"
              : "border-white/10 hover:border-white/20"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isUploading}
        />

        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-white font-medium">Drag files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">
          Images up to 10MB, .cfg/.lua up to 2MB • Max {maxFiles} files
        </p>
      </div>

      {/* Error messages */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {Object.keys(validationErrors).length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs text-destructive space-y-1">
            {Object.entries(validationErrors).map(([key, msg]) => (
              <div key={key}>{msg}</div>
            ))}
          </div>
        </div>
      )}

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Files ({selectedFiles.length}/{maxFiles})
          </h4>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-2 p-2 bg-black/30 rounded border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  disabled={isUploading}
                  className="p-1 hover:bg-white/5 rounded transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
