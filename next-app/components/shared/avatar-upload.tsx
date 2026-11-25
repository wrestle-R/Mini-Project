"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { FiCamera, FiLoader } from "react-icons/fi";
import { toast } from "sonner";

interface AvatarUploadProps {
  currentUrl?: string | null;
  fallbackInitial: string;
  role: "company" | "contractor" | "worker";
  token: string | null;
  onUploaded: (url: string) => void;
  size?: number;
}

export function AvatarUpload({
  currentUrl,
  fallbackInitial,
  role,
  token,
  onUploaded,
  size = 80,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayUrl = previewUrl || currentUrl;

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPEG, PNG, WebP, and GIF images are allowed");
      return;
    }

    // Validate size
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("role", role);

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setPreviewUrl(data.url);
      onUploaded(data.url);
      toast.success(role === "company" ? "Logo updated!" : "Photo updated!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative group" style={{ width: size, height: size }}>
      {displayUrl ? (
        <Image
          src={displayUrl}
          alt="Profile"
          width={size}
          height={size}
          className="rounded-full object-cover border-2 border-border"
          style={{ width: size, height: size }}
          unoptimized={displayUrl.startsWith("blob:")}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold"
          style={{ width: size, height: size, fontSize: size * 0.35 }}
        >
          {fallbackInitial}
        </div>
      )}

      {/* Overlay button */}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Upload profile photo"
        className="absolute bottom-0 right-0 h-7 w-7 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleClick}
        disabled={uploading}
      >
        {uploading ? (
          <FiLoader className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FiCamera className="h-3.5 w-3.5" />
        )}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
