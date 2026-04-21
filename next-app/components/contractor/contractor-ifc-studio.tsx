"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  FiClock,
  FiCornerDownLeft,
  FiDownload,
  FiLayers,
  FiRefreshCw,
  FiRotateCw,
  FiSave,
  FiTrash2,
  FiUploadCloud,
  FiZap,
} from "react-icons/fi";
import { useContractor } from "@/contexts/ContractorContext";
import type { ElementMetadata } from "@/components/ModelViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[500px] h-full items-center justify-center text-stone-400">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-400/70 border-t-transparent" />
        <span className="text-sm tracking-[0.2em] uppercase">Loading viewer</span>
      </div>
    </div>
  ),
});

type MessageRole = "user" | "assistant";
interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  explanation?: string;
  plan?: string[];
  actions?: Record<string, unknown>[];
  timestamp: string;
  error?: string;
  versionId?: string | null;
  versionNumber?: number | null;
}

interface SessionSummary {
  id: string;
  title: string;
  sourceFileName: string;
  status: string;
  currentGlbUrl: string;
  currentJsonUrl: string;
  currentMetadataUrl: string;
  currentVersionId?: string | null;
  currentVersionNumber?: number;
  versionCount: number;
  lastSavedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionDetailPayload {
  session: SessionSummary;
  messages: ChatMessage[];
  versions: Array<unknown>;
}

function summarizeElementProperties(
  properties: Record<string, Record<string, unknown>>
) {
  const entries: string[] = [];

  for (const [groupName, groupValues] of Object.entries(properties)) {
    for (const [key, value] of Object.entries(groupValues)) {
      if (entries.length >= 8) break;
      entries.push(`${groupName}.${key}: ${formatPropertyValue(value)}`);
    }
    if (entries.length >= 8) break;
  }

  return entries.join(" | ");
}

const COMMAND_EXAMPLES = [
  "make the roof blue",
  "make all walls 4 meters tall",
  "rename this door to Service Entry",
  "undo last change",
  "reset to the original upload",
];

export function ContractorIfcStudio() {
  const { token } = useContractor();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<SessionSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [historyAction, setHistoryAction] = useState<"undo" | "reset" | string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementMetadata | null>(null);
  const [pinnedContexts, setPinnedContexts] = useState<ElementMetadata[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const modelUrl = activeSession?.currentGlbUrl || null;
  const metadataUrl = activeSession?.currentMetadataUrl || null;

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (!token) return;
      try {
        const res = await fetch(`/api/contractor/ifc/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load session");
        const data = (await res.json()) as SessionDetailPayload;
        setActiveSession(data.session);
        setMessages(data.messages || []);
        setSelectedElement(null);
        setPinnedContexts([]);
      } catch {
        toast.error("Failed to load IFC session");
      }
    },
    [token]
  );

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    try {
      const res = await fetch("/api/contractor/ifc/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      const nextSessions = (data.sessions || []) as SessionSummary[];
      setSessions(nextSessions);

      const currentId = activeSession?.id;
      const nextActive =
        (currentId && nextSessions.find((session) => session.id === currentId)) ||
        nextSessions[0] ||
        null;

      if (!nextActive) {
        setActiveSession(null);
        setMessages([]);
        return;
      }

      setActiveSession(nextActive);
      if (!currentId || currentId !== nextActive.id) {
        await loadSession(nextActive.id);
      }
    } catch {
      toast.error("Could not load IFC history");
    } finally {
      setListLoading(false);
    }
  }, [token, activeSession?.id, loadSession]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [messages]);

  const submitChatMessage = useCallback(
    async (rawText: string) => {
      if (!token || !activeSession || !rawText.trim()) return;

      const text = rawText.trim();
      const optimisticUserMessage: ChatMessage = {
        id: `tmp_${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMessage]);
      setChatLoading(true);

      try {
        const allContexts = [...pinnedContexts];
        if (
          selectedElement &&
          !allContexts.some((ctx) => ctx.globalId === selectedElement.globalId)
        ) {
          allContexts.push(selectedElement);
        }
        const selectedContexts = allContexts.map((ctx) => ({
          element_id: ctx.globalId,
          element_type: ctx.type || "element",
          element_name: ctx.name || "",
          property_summary: summarizeElementProperties(ctx.properties),
        }));

        const res = await fetch(`/api/contractor/ifc/sessions/${activeSession.id}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            selectedContexts,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Chat failed");

        await loadSession(activeSession.id);
        await fetchSessions();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Chat failed";
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: "Error",
            error: message,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setChatLoading(false);
      }
    },
    [token, activeSession, pinnedContexts, selectedElement, loadSession, fetchSessions]
  );

  const handleUploadFile = async (file: File) => {
    if (!token) return;
    if (!file.name.toLowerCase().endsWith(".ifc")) {
      toast.error("Only .ifc files are supported");
      return;
    }
    if (uploading) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/contractor/ifc/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Upload failed");

      await fetchSessions();
      if (data?.session?.id) {
        await loadSession(data.session.id);
      }
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    await handleUploadFile(file);
  };

  const handleSendMessage = async () => {
    if (!token || !activeSession || !chatInput.trim()) return;

    const text = chatInput.trim();
    setChatInput("");
    await submitChatMessage(text);
  };

  const handleSave = async () => {
    if (!token || !activeSession) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contractor/ifc/sessions/${activeSession.id}/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Save failed");
      toast.success("Snapshot saved");
      await loadSession(activeSession.id);
      await fetchSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleHistoryOperation = async (
    payload: { mode: "undo" | "reset"; versionId?: never } | { mode: "version"; versionId: string }
  ) => {
    if (!token || !activeSession) return;
    const actionKey =
      payload.mode === "version" ? payload.versionId : payload.mode;
    setHistoryAction(actionKey);
    try {
      const res = await fetch(`/api/contractor/ifc/sessions/${activeSession.id}/rollback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Rollback failed");
      await loadSession(activeSession.id);
      await fetchSessions();
      toast.success(
        payload.mode === "undo"
          ? "Undid last change"
          : payload.mode === "reset"
          ? "Restored original upload"
          : "Rolled back checkpoint"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setHistoryAction(null);
    }
  };

  const handleDeleteSession = async () => {
    if (!token || !activeSession || deleting) return;
    const confirmed = window.confirm(
      `Delete "${activeSession.title}" and all saved checkpoints? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const deletingId = activeSession.id;
      const res = await fetch(`/api/contractor/ifc/sessions/${deletingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Delete failed");

      setActiveSession(null);
      setMessages([]);
      setSelectedElement(null);
      setPinnedContexts([]);
      await fetchSessions();
      toast.success("IFC session deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!token || !activeSession) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/contractor/ifc/sessions/${activeSession.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Download failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activeSession.title.replace(/\.ifc$/i, "") || "ifc-model"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const togglePinnedContext = (element: ElementMetadata) => {
    setPinnedContexts((prev) =>
      prev.some((ctx) => ctx.globalId === element.globalId)
        ? prev.filter((ctx) => ctx.globalId !== element.globalId)
        : [...prev, element]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IFC Studio</h1>
        <p className="text-muted-foreground">
          Edit IFC models with chat, rotate the model, save checkpoints, and roll back versions.
        </p>
      </div>

      <Card className="overflow-hidden border-border/70">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">Contractor IFC Studio</CardTitle>
              <CardDescription className="max-w-3xl">
                Chat edits create checkpoints automatically. Manual save, undo, reset, rotate, and delete are available for each session.
              </CardDescription>
              {activeSession && (
                <p className="text-sm text-muted-foreground">
                  Active session: {activeSession.title}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={handleSave}
                disabled={!activeSession || saving}
              >
                <FiSave className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Snapshot"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void handleHistoryOperation({ mode: "undo" });
                }}
                disabled={!activeSession || historyAction !== null}
              >
                <FiCornerDownLeft className="mr-2 h-4 w-4" />
                {historyAction === "undo" ? "Undoing..." : "Undo"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void handleHistoryOperation({ mode: "reset" });
                }}
                disabled={!activeSession || historyAction !== null}
              >
                <FiRefreshCw className="mr-2 h-4 w-4" />
                {historyAction === "reset" ? "Resetting..." : "Reset Original"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={!activeSession || downloading}
              >
                <FiDownload className="mr-2 h-4 w-4" />
                {downloading ? "Downloading..." : "Download"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDeleteSession}
                disabled={!activeSession || deleting}
              >
                <FiTrash2 className="mr-2 h-4 w-4" />
                {deleting ? "Deleting..." : "Delete IFC"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid min-h-[calc(100vh-250px)] grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <Card className="h-full">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FiClock className="h-4 w-4" />
                Session History
              </CardTitle>
              <CardDescription>
                Original uploads, chat checkpoints, manual saves, and rollback targets.
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <FiLayers className="h-4 w-4" />
                  Sessions
                </div>
                <p className="text-lg font-semibold">{sessions.length}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <FiClock className="h-4 w-4" />
                  Current
                </div>
                <p className="text-lg font-semibold">v{activeSession?.currentVersionNumber || 0}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".ifc"
              className="hidden"
              id="ifc-upload-input"
              onChange={(event) => {
                void handleFileInputChange(event);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDraggingUpload(true);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setDraggingUpload(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDraggingUpload(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDraggingUpload(false);
                const file = event.dataTransfer.files?.[0];
                if (!file) return;
                void handleUploadFile(file);
              }}
              disabled={uploading}
              className={`w-full rounded-xl border px-4 py-5 text-left transition ${
                draggingUpload
                  ? "border-primary bg-primary/10"
                  : "bg-muted/20 hover:bg-muted/40"
              } ${uploading ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <FiUploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {uploading ? "Uploading IFC..." : "Drop or select an IFC file"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Upload starts immediately and stores the original model as version 1.
                  </p>
                </div>
              </div>
            </button>

            <Separator />

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Saved Sessions
              </p>
              <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                {listLoading ? (
                  <p className="text-sm text-muted-foreground">Loading IFC history...</p>
                ) : sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                    No IFC sessions yet.
                  </div>
                ) : (
                  sessions.map((session) => {
                    const active = activeSession?.id === session.id;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-primary bg-primary/10"
                            : "hover:bg-muted/40"
                        }`}
                        onClick={() => {
                          void loadSession(session.id);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {session.title}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              v{session.currentVersionNumber || 0} live
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {session.versionCount} checkpoints
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{formatDateLabel(session.updatedAt)}</span>
                          <span>{session.lastSavedAt ? "Manual save" : "Auto tracked"}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid h-[calc(100vh-330px)] min-h-[700px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.95fr)]">
            <Card className="relative overflow-hidden">
              <CardHeader className="border-b py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Model Viewer</CardTitle>
                    <CardDescription>
                      Click any element, pin it into context, rotate the model, or drive edits from chat.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["x", "y", "z"] as const).map((axis) => (
                      <Button
                        key={axis}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!activeSession || chatLoading}
                        onClick={() => {
                          void submitChatMessage(
                            `rotate the whole model 90 degrees on the ${axis} axis`
                          );
                        }}
                      >
                        <FiRotateCw className="mr-2 h-3.5 w-3.5" />
                        Rotate {axis.toUpperCase()}
                      </Button>
                    ))}
                    {pinnedContexts.map((ctx) => (
                      <button
                        key={ctx.globalId}
                        type="button"
                        onClick={() => togglePinnedContext(ctx)}
                        className="rounded-full border bg-muted/20 px-3 py-1 text-[11px] transition hover:bg-muted/40"
                      >
                        {ctx.name || ctx.type} x
                      </button>
                    ))}
                    {pinnedContexts.length === 0 && (
                      <Badge variant="outline">
                        No pinned context
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative h-full p-0">
                {modelUrl && metadataUrl ? (
                  <div className="relative h-full">
                    <ModelViewer
                      modelUrl={modelUrl}
                      metadataUrl={metadataUrl}
                      authToken={token}
                      onElementSelect={setSelectedElement}
                    />
                    <AnimatePresence>
                      {selectedElement && (
                        <motion.div
                          initial={{ opacity: 0, y: 14, x: 16 }}
                          animate={{ opacity: 1, y: 0, x: 0 }}
                          exit={{ opacity: 0, y: 12, x: 16 }}
                          className="absolute left-3 top-3 flex w-[310px] max-w-[calc(100%-1.5rem)] max-h-[calc(100%-1.5rem)] flex-col rounded-xl border bg-background/95 shadow-xl"
                        >
                          <div className="flex items-start justify-between gap-3 border-b p-4">
                            <div className="min-w-0">
                              <span className="mb-2 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                                {selectedElement.type}
                              </span>
                              <h3 className="truncate text-sm font-semibold">
                                {selectedElement.name || "Unnamed Element"}
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedElement(null)}
                              className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            >
                              x
                            </button>
                          </div>
                          <div className="space-y-3 overflow-y-auto p-4 text-xs">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => togglePinnedContext(selectedElement)}
                              >
                                <FiZap className="mr-2 h-3.5 w-3.5" />
                                {pinnedContexts.some(
                                  (ctx) => ctx.globalId === selectedElement.globalId
                                )
                                  ? "Unpin Context"
                                  : "Pin For Chat"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setChatInput(`rename the selected ${selectedElement.type.toLowerCase()} to `)
                                }
                              >
                                Prompt From Selection
                              </Button>
                            </div>

                            <div>
                              <p className="mb-1 font-medium text-muted-foreground">
                                Global ID
                              </p>
                              <p className="break-all font-mono">
                                {selectedElement.globalId}
                              </p>
                            </div>

                            {Object.entries(selectedElement.properties).map(([psetName, props]) => (
                              <div key={psetName} className="rounded-lg border bg-muted/20 p-3">
                                <p className="mb-2 font-semibold text-muted-foreground">
                                  {psetName}
                                </p>
                                <div className="space-y-1.5">
                                  {Object.entries(props as Record<string, unknown>).map(
                                    ([key, value]) => (
                                      <div
                                        key={key}
                                        className="flex items-start justify-between gap-3 border-b pb-1.5 last:border-b-0"
                                      >
                                        <span className="text-muted-foreground">{key}</span>
                                        <span className="break-all text-right">
                                          {formatPropertyValue(value)}
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
                    Upload an IFC file or select a saved session to open the viewer.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex overflow-hidden">
              <CardContent className="flex h-full flex-1 flex-col p-0">
                <div className="border-b px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">Architectural Assistant</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Chat edits auto-save checkpoints. Use undo or reset when you want to move backward.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-b px-4 py-3">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Prompt Starters
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COMMAND_EXAMPLES.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setChatInput(prompt)}
                        className="rounded-full border bg-muted/20 px-3 py-1.5 text-[11px] transition hover:bg-muted/40"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-muted/10 p-4">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed px-6 text-center text-xs text-muted-foreground">
                      Start editing with natural language. Chat edits, manual saves, undo, and rollbacks all persist in this timeline.
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[94%] rounded-xl border px-4 py-3 text-xs ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : msg.error
                                ? "border-destructive/20 bg-destructive/10 text-destructive"
                                : "bg-background"
                            }`}
                          >
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                              <span>{msg.role === "user" ? "You" : "Assistant"}</span>
                              <span>{formatTimeLabel(msg.timestamp)}</span>
                              {msg.versionNumber ? (
                                <Badge variant="outline" className="text-[10px]">
                                  v{msg.versionNumber}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap leading-6">{msg.content}</p>
                            {msg.explanation ? (
                              <p className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                                {msg.explanation}
                              </p>
                            ) : null}
                            {msg.error && <p className="mt-2 opacity-80">{msg.error}</p>}
                            {msg.actions && msg.actions.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {msg.actions.map((action, index) => (
                                  <Badge
                                    key={`${msg.id}_${index}`}
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {String(action.type || "action")}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                            {msg.versionId && msg.versionNumber ? (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleHistoryOperation({
                                      mode: "version",
                                      versionId: msg.versionId!,
                                    });
                                  }}
                                  disabled={historyAction !== null}
                                  className="rounded-full border bg-muted/20 px-3 py-1.5 text-[11px] transition hover:bg-muted/40"
                                >
                                  Roll Back To v{msg.versionNumber}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                <div className="border-t p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedElement && (
                      <Badge variant="secondary">
                        Selected: {selectedElement.name || selectedElement.type}
                      </Badge>
                    )}
                    {pinnedContexts.map((ctx) => (
                      <Badge key={ctx.globalId} variant="outline">
                        Context: {ctx.name || ctx.type}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder={
                        activeSession
                          ? "Describe your IFC change in plain English..."
                          : "Open a session first"
                      }
                      disabled={!activeSession || chatLoading}
                      className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                    />
                    <Button
                      onClick={() => {
                        void handleSendMessage();
                      }}
                      disabled={!activeSession || chatLoading || !chatInput.trim()}
                    >
                      {chatLoading ? "Sending..." : "Send"}
                    </Button>
                  </div>
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    Enter sends immediately. Chat edits auto-create rollback checkpoints; Save Snapshot creates a named manual version.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }
  if (Array.isArray(value)) return value.map(formatPropertyValue).join(", ");
  return String(value);
}
