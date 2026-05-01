"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Send, MapPin, Layers, Sparkles, Loader2, AlertCircle } from "lucide-react";
import type { ChatMessage, ChatActionEvent, MapEvent } from "./types";

const BACKEND = process.env.NEXT_PUBLIC_PYTHON_API_BASE_URL || "http://localhost:8000";

const SUGGESTED_PROMPTS = [
  "Take me to Mumbai",
  "Show rural areas in Maharashtra",
  "Find land near Pune highways",
  "Draw polygon over Delhi",
  "Show good spots near Bangalore",
];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  flyTo: <MapPin className="w-3.5 h-3.5 text-sky-400" />,
  drawPolygon: <Layers className="w-3.5 h-3.5 text-violet-400" />,
  suggestAreas: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />,
  filterAreas: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
  none: null,
};

const ACTION_LABELS: Record<string, string> = {
  flyTo: "Navigating",
  drawPolygon: "Drawing polygon",
  suggestAreas: "Showing suggestions",
  filterAreas: "Filtering results",
  none: "",
};

interface GisChatProps {
  onMapEvent: (event: MapEvent) => void;
  selectedPolygonInfo?: { areaSqm: number; centroid: [number, number] } | null;
}

export default function GisChat({ onMapEvent, selectedPolygonInfo }: GisChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Set initial welcome message on mount
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "agent",
        content: "Hi! I'm your Spatial Intelligence assistant. Tell me where you'd like to explore, or ask me to find the best land spots anywhere in India.",
        timestamp: Date.now(),
      },
    ]);
  }, []);


  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  const addMessage = useCallback(
    (msg: Omit<ChatMessage, "id" | "timestamp">) => {
      const full: ChatMessage = { ...msg, id: crypto.randomUUID(), timestamp: Date.now() };
      setMessages((prev) => [...prev, full]);
      scrollToBottom();
      return full;
    },
    [scrollToBottom]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      setError(null);
      setInput("");

      addMessage({ role: "user", content: text });
      setLoading(true);

      try {
        const res = await fetch(`${BACKEND}/api/gis/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: messages.slice(-6).map(m => ({ 
              role: m.role, 
              content: m.content.length > 500 ? m.content.substring(0, 500) + "..." : m.content 
            })),
            context: selectedPolygonInfo ?? null,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail ?? "Agent error");
        }

        const event: ChatActionEvent = await res.json();

        // Dispatch to map
        if (event.action_type !== "none") {
          onMapEvent({ type: event.action_type, payload: event.payload });
        }

        addMessage({
          role: "agent",
          content: event.explanation,
          actionEvent: event,
        });

        if (event.follow_up) {
          setTimeout(() => {
            addMessage({ role: "agent", content: event.follow_up! });
          }, 600);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        addMessage({ role: "agent", content: `⚠️ ${msg}` });
      } finally {
        setLoading(false);
      }
    },
    [loading, addMessage, onMapEvent, selectedPolygonInfo]
  );

  return (
    <div className="flex flex-col h-full bg-[#0f1117] text-white">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex-none px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Spatial Agent</p>
            <p className="text-[11px] text-white/40 mt-0.5">India Land Intelligence</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => {
                if (confirm("Clear chat history?")) {
                  localStorage.removeItem("gis_chat_history");
                  window.location.reload();
                }
              }}
              className="text-[10px] text-white/30 hover:text-red-400 transition-colors uppercase tracking-wider font-bold"
            >
              Clear
            </button>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5 font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </span>
          </div>
        </div>

        {/* Selected polygon info strip */}
        {selectedPolygonInfo && (
          <div className="mt-2 p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex gap-3 text-[11px]">
            <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-none mt-0.5" />
            <div>
              <p className="text-indigo-300 font-medium">Selected Parcel</p>
              <p className="text-white/50 mt-0.5">
                {(selectedPolygonInfo.areaSqm / 10000).toFixed(2)} ha ·{" "}
                {selectedPolygonInfo.centroid[1].toFixed(4)}°N,{" "}
                {selectedPolygonInfo.centroid[0].toFixed(4)}°E
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-white/8 border border-white/10 text-white/90 rounded-bl-sm"
              }`}
            >
              {msg.role === "agent" && msg.actionEvent && msg.actionEvent.action_type !== "none" && (
                <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-white/10">
                  {ACTION_ICONS[msg.actionEvent.action_type]}
                  <span className="text-[11px] font-medium text-white/50 uppercase tracking-wide">
                    {ACTION_LABELS[msg.actionEvent.action_type]}
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className="text-[10px] text-white/30 mt-1.5 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/8 border border-white/10 rounded-xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span className="text-sm text-white/50">Thinking…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Suggested prompts (Minimized) ─────────────────────────── */}
      {messages.length <= 1 && (
        <div className="flex-none px-4 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
             <div className="h-[1px] flex-1 bg-white/5" />
             <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest whitespace-nowrap">
               Try asking
             </p>
             <div className="h-[1px] flex-1 bg-white/5" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                disabled={loading}
                className="flex-none text-[10px] px-2.5 py-1 rounded-lg border border-white/5 bg-white/5 text-white/40
                           hover:bg-indigo-500/15 hover:border-indigo-500/30 hover:text-indigo-300
                           transition-all duration-150 disabled:opacity-40 whitespace-nowrap"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex-none mx-4 mb-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-none" />
          {error}
        </div>
      )}

      {/* ── Input ──────────────────────────────────────────────────── */}
      <div className="flex-none p-4 border-t border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <input
            id="gis-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Show rural plots near Nagpur…"
            disabled={loading}
            className="flex-1 bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white
                       placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60
                       focus:bg-indigo-500/5 transition-all duration-150 disabled:opacity-50"
          />
          <button
            id="gis-chat-send"
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex-none w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                       flex items-center justify-center transition-all duration-150 shadow-lg shadow-indigo-500/20
                       disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
