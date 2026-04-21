"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useContractor } from "@/contexts/ContractorContext";
import type { ElementMetadata } from "@/components/ModelViewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FiClock, FiDownload, FiFolder, FiSave, FiUploadCloud } from "react-icons/fi";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[500px] text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm">Loading 3D viewer...</span>
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
}

interface SessionSummary {
  id: string;
  title: string;
  sourceFileName: string;
  status: string;
  currentGlbUrl: string;
  currentJsonUrl: string;
  currentMetadataUrl: string;
  versionCount: number;
  lastSavedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionVersion {
  id: string;
  versionNumber: number;
  label: string;
  createdAt: string;
}

interface SessionDetailPayload {
  session: SessionSummary;
  messages: ChatMessage[];
  versions: SessionVersion[];
}

export function ContractorIfcStudio() {
  const { token } = useContractor();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<SessionSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [versions, setVersions] = useState<SessionVersion[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementMetadata | null>(null);
  const [pinnedContexts, setPinnedContexts] = useState<ElementMetadata[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const modelUrl = activeSession?.currentGlbUrl || null;
  const metadataUrl = activeSession?.currentMetadataUrl || null;

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
      if (!activeSession && nextSessions.length > 0) {
        setActiveSession(nextSessions[0]);
      }
    } catch {
      toast.error("Could not load IFC history");
    } finally {
      setListLoading(false);
    }
  }, [token, activeSession]);

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
        setVersions(data.versions || []);
        setSelectedElement(null);
        setPinnedContexts([]);
      } catch {
        toast.error("Failed to load IFC session");
      }
    },
    [token]
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [messages]);

  const handleUpload = async () => {
    if (!token) return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;

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
      toast.success("IFC model uploaded");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!token || !activeSession || !chatInput.trim()) return;

    const text = chatInput.trim();
    setChatInput("");

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

      if (data?.assistantMessage) {
        setMessages((prev) => [...prev, data.assistantMessage]);
      }
      if (data?.session) {
        setActiveSession(data.session as SessionSummary);
        setSessions((prev) =>
          prev.map((session) =>
            session.id === data.session.id ? (data.session as SessionSummary) : session
          )
        );
      }
      if (data?.updated) {
        setSelectedElement(null);
      }
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

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr] min-h-[calc(100vh-120px)]">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FiClock className="h-4 w-4" />
            IFC History
          </CardTitle>
          <CardDescription>Previous projects, chat timelines, and snapshots.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".ifc"
            className="hidden"
            id="ifc-upload-input"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <FiFolder className="mr-2 h-4 w-4" />
              Select IFC
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              <FiUploadCloud className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>

          <Separator />

          <div className="max-h-[68vh] overflow-y-auto space-y-2 pr-1">
            {listLoading ? (
              <p className="text-sm text-muted-foreground">Loading history...</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No IFC sessions yet.</p>
            ) : (
              sessions.map((session) => {
                const active = activeSession?.id === session.id;
                return (
                  <button
                    key={session.id}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                      active ? "border-primary bg-primary/10" : "hover:bg-muted/60"
                    }`}
                    onClick={() => loadSession(session.id)}
                  >
                    <p className="font-medium text-sm truncate">{session.title}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {session.versionCount} saves
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">Contractor IFC Studio</CardTitle>
              <CardDescription>
                Protected IFC editing with persistent history, snapshots, and export.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleSave}
                disabled={!activeSession || saving}
              >
                <FiSave className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={!activeSession || downloading}
              >
                <FiDownload className="mr-2 h-4 w-4" />
                {downloading ? "Downloading..." : "Download"}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 h-[calc(100vh-270px)] min-h-[620px]">
          <Card className="lg:col-span-2 overflow-hidden flex flex-col">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Model Viewer</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 relative">
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
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        className="absolute top-3 left-3 w-72 max-h-[calc(100%-1.5rem)] bg-card/95 backdrop-blur-sm border rounded-lg shadow-xl flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-2 p-4 border-b">
                          <div className="min-w-0">
                            <span className="inline-block rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary mb-1">
                              {selectedElement.type}
                            </span>
                            <h3 className="font-semibold text-sm truncate">
                              {selectedElement.name || "Unnamed Element"}
                            </h3>
                          </div>
                          <button
                            onClick={() => setSelectedElement(null)}
                            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            x
                          </button>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-3 text-xs">
                          <div>
                            <p className="font-medium text-muted-foreground mb-1">Global ID</p>
                            <p className="font-mono break-all">{selectedElement.globalId}</p>
                          </div>
                          {Object.entries(selectedElement.properties).map(([psetName, props]) => (
                            <div key={psetName}>
                              <p className="font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                {psetName}
                              </p>
                              <div className="space-y-1">
                                {Object.entries(props as Record<string, unknown>).map(
                                  ([key, value]) => (
                                    <div key={key} className="flex justify-between gap-3 border-b pb-1">
                                      <span className="text-muted-foreground">{key}</span>
                                      <span className="text-right break-all">{formatPropertyValue(value)}</span>
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
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Upload and open a session to view your IFC model.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden flex flex-col">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Architectural Assistant</CardTitle>
              <CardDescription className="text-xs">
                Persistent chat with project history and snapshot versions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              <div className="px-3 py-2 border-b bg-muted/20">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Saved Versions</p>
                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                  {versions.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No snapshots yet</span>
                  ) : (
                    versions.map((version) => (
                      <Badge key={version.id} variant="outline" className="text-[10px]">
                        v{version.versionNumber}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground text-center">
                    Start editing with natural language. Your chat and versions are saved in history.
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : msg.error
                              ? "bg-destructive/10 text-destructive border border-destructive/20"
                              : "bg-secondary text-secondary-foreground border"
                          }`}
                        >
                          <p>{msg.content}</p>
                          {msg.error && <p className="mt-1 opacity-80">{msg.error}</p>}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              <div className="border-t p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={activeSession ? "Describe your changes..." : "Open a session first"}
                    disabled={!activeSession || chatLoading}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!activeSession || chatLoading || !chatInput.trim()}
                  >
                    {chatLoading ? "..." : "Send"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Press Enter to send. Save creates manual immutable snapshot versions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
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
