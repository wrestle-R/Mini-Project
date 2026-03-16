"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[500px] text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm">Loading 3D viewer…</span>
      </div>
    </div>
  ),
});

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function IFCViewerPage() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = () => {
    const file = fileRef.current?.files?.[0];
    setFileName(file?.name ?? null);
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setErrorMsg("");
    setModelUrl(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/ifc/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Server error (${res.status})`);
      }

      const data = await res.json();
      setModelUrl(data.model_url);
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">IFC Blueprint Viewer</CardTitle>
              <CardDescription>
                Upload an IFC file to convert it into an interactive 3D model
                you can explore right in the browser.
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Upload card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Hidden native input */}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ifc"
                  id="ifc-file-input"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Custom styled file picker */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 w-full sm:w-auto flex items-center gap-3 rounded-lg border border-input bg-secondary/40 px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground shrink-0"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                  <span className="truncate">
                    {fileName ?? "Choose an IFC file…"}
                  </span>
                </button>

                {/* Upload button */}
                <button
                  id="upload-btn"
                  onClick={handleUpload}
                  disabled={status === "uploading" || !fileName}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {status === "uploading" ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Converting…
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" x2="12" y1="3" y2="15" />
                      </svg>
                      Upload &amp; Convert
                    </>
                  )}
                </button>
              </div>

              {/* Status messages */}
              {status === "uploading" && (
                <p className="mt-4 text-sm text-muted-foreground animate-pulse">
                  Uploading and converting — this may take a moment for large
                  blueprints…
                </p>
              )}
              {status === "error" && (
                <p className="mt-4 text-sm text-destructive">{errorMsg}</p>
              )}
              {status === "success" && (
                <p className="mt-4 text-sm text-green-500">
                  ✓ Model converted successfully. Use your mouse to rotate,
                  scroll to zoom, and right-click to pan.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 3D Viewer area */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
        >
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {modelUrl ? (
                <div className="h-[65vh] min-h-[500px]">
                  <ModelViewer modelUrl={modelUrl} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="opacity-30"
                  >
                    <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
                    <path d="m14 7 3 3" />
                    <path d="M5 6v4" />
                    <path d="M19 14v4" />
                    <path d="M10 2v2" />
                    <path d="M7 8H3" />
                    <path d="M21 16h-4" />
                    <path d="M11 3H9" />
                  </svg>
                  <p className="text-sm">
                    Your 3D model will appear here after upload
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
