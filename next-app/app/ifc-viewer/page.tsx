"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ElementMetadata } from "@/components/ModelViewer";

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
type MessageRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  action?: Record<string, unknown>;
  error?: string;
}

export default function IFCViewerPage() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [metadataUrl, setMetadataUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] =
    useState<ElementMetadata | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    setMetadataUrl(null);
    setProjectId(null);
    setSelectedElement(null);
    setMessages([]);

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
      setProjectId(data.project_id);
      setModelUrl(data.model_url);
      setMetadataUrl(data.metadata_url ?? null);
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !projectId) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: chatInput.trim(),
      timestamp: Date.now(),
    };

    setChatInput("");
    setChatError("");
    setMessages((prev) => [...prev, userMessage]);
    setChatLoading(true);

    try {
      const formData = new FormData();
      formData.append("message", userMessage.content);

      const res = await fetch(`http://localhost:8000/api/chat/${projectId}`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message ?? "Failed to process instruction");
      }

      if (data.reply) {
        const assistantReply: ChatMessage = {
          id: `msg_${Date.now()}_reply`,
          role: "assistant",
          content: data.reply,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantReply]);
        return;
      }

      // Update model viewer with new GLB (cache bust with timestamp)
      const newModelUrl = data.model_url + "?t=" + Date.now();
      setModelUrl(newModelUrl);

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_ai`,
        role: "assistant",
        content: `Action: ${data.action.action}`,
        timestamp: Date.now(),
        action: data.action,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Error processing message");
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: "assistant",
        content: "Error",
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : "Unknown error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
                Upload an IFC file to convert it into an interactive 3D model.
                Click on any element to inspect its properties and metadata.
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
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ifc"
                  id="ifc-file-input"
                  className="hidden"
                  onChange={handleFileChange}
                />

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
                  Model converted successfully. Rotate with left mouse, zoom
                  with scroll, pan with right mouse. Click any element to
                  inspect it.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 3D Viewer + Chat area */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[70vh] min-h-[600px]">
            {/* 3D Viewer - 2 columns on large screens */}
            <Card className="overflow-hidden lg:col-span-2">
              <CardContent className="p-0 h-full">
                {modelUrl ? (
                  <div className="relative h-full">
                    <ModelViewer
                      modelUrl={modelUrl}
                      metadataUrl={metadataUrl ?? undefined}
                      onElementSelect={setSelectedElement}
                    />

                    {/* Element info panel overlay */}
                    <AnimatePresence>
                      {selectedElement && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-3 left-3 w-72 max-h-[calc(100%-1.5rem)] bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl flex flex-col z-10"
                        >
                          {/* Panel header */}
                          <div className="flex items-start justify-between gap-2 p-4 border-b border-border">
                            <div className="min-w-0">
                              <span className="inline-block rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary mb-1">
                                {selectedElement.type}
                              </span>
                              <h3 className="font-semibold text-sm truncate">
                                {selectedElement.name || "Unnamed Element"}
                              </h3>
                              {selectedElement.objectType && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  Type: {selectedElement.objectType}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedElement(null)}
                              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            >
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
                                <line x1="18" x2="6" y1="6" y2="18" />
                                <line x1="6" x2="18" y1="6" y2="18" />
                              </svg>
                            </button>
                          </div>

                          {/* Panel body — scrollable */}
                          <div className="overflow-y-auto p-4 space-y-4 text-sm flex-1">
                            {/* Global ID */}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Global ID
                              </p>
                              <p className="font-mono text-xs break-all">
                                {selectedElement.globalId}
                              </p>
                            </div>

                            {/* Description */}
                            {selectedElement.description && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Description
                                </p>
                                <p className="text-xs">
                                  {selectedElement.description}
                                </p>
                              </div>
                            )}

                            {/* Property Sets */}
                            {Object.entries(selectedElement.properties).length >
                            0 ? (
                              Object.entries(selectedElement.properties).map(
                                ([psetName, props]) => (
                                  <div key={psetName}>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                      {psetName}
                                    </p>
                                    <div className="space-y-1">
                                      {Object.entries(
                                        props as Record<string, unknown>
                                      ).map(([key, value]) => (
                                        <div
                                          key={key}
                                          className="flex justify-between gap-3 py-1 border-b border-border/40 last:border-0"
                                        >
                                          <span className="text-muted-foreground text-xs shrink-0">
                                            {key}
                                          </span>
                                          <span className="text-xs text-right break-all">
                                            {formatPropertyValue(value)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              )
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                No property sets available for this element.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
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

            {/* Chat Panel - 1 column */}
            <Card className="overflow-hidden flex flex-col">
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Architectural Assistant</CardTitle>
                <CardDescription className="text-xs">
                  Describe changes in natural language
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-30 mb-2"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <p className="text-xs">
                        Try: "Make all walls 4 meters tall"
                      </p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex ${
                            msg.role === "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : msg.error
                                ? "bg-destructive/10 text-destructive border border-destructive/20"
                                : "bg-secondary text-secondary-foreground"
                            }`}
                          >
                            <p className="text-xs leading-relaxed">
                              {msg.content}
                            </p>
                            {msg.action && (
                              <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                                <p className="text-xs font-mono opacity-75 break-words whitespace-pre-wrap">
                                  {JSON.stringify(msg.action, null, 2).substring(
                                    0,
                                    120
                                  )}
                                  {JSON.stringify(msg.action).length > 120
                                    ? "..."
                                    : ""}
                                </p>
                              </div>
                            )}
                            {msg.error && (
                              <p className="text-xs mt-1 opacity-75">
                                {msg.error}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input area */}
                <div className="border-t p-3 space-y-2">
                  {chatError && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
                      {chatError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Describe your changes..."
                      disabled={chatLoading || !modelUrl}
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={chatLoading || !modelUrl || !chatInput.trim()}
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {chatLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      ) : (
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
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {!modelUrl
                      ? "Upload a model to chat"
                      : "Press Enter or click Send"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    // Round long decimals for display
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }
  if (Array.isArray(value)) return value.map(formatPropertyValue).join(", ");
  return String(value);
}
