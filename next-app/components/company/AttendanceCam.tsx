"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Camera,
  CameraOff,
  RefreshCw,
  ScanFace,
  Shield,
  ShieldCheck,
  ShieldAlert,
  User,
  Activity,
  Eye,
  Gauge,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
interface LivenessData {
  is_alive: boolean;
  details: {
    ear: number;
    blinks: number;
    status: string;
  };
}

interface MatchData {
  id: string | null;
  name: string;
  score: number;
  bbox: number[];
  ppe?: { compliant: boolean; hard_hat: boolean; vest: boolean };
}

interface RecognitionResponse {
  status: string;
  liveness: LivenessData;
  matches: MatchData[];
}

const API_BASE = "http://localhost:8000";
const SOURCE_ID = "web-cam";

// ─── Component ───────────────────────────────────────────────────────
export function AttendanceCam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [captureInterval, setCaptureInterval] = useState(800);
  const [checkPPE, setCheckPPE] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [liveness, setLiveness] = useState<LivenessData | null>(null);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [frameCount, setFrameCount] = useState(0);
  const [backendStatus, setBackendStatus] = useState<
    "idle" | "connected" | "error"
  >("idle");

  // ── Start Camera ────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
      toast.success("Camera started");
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Failed to access camera. Please grant permission.");
    }
  }, []);

  // ── Stop Camera ─────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setIsStreaming(false);
    setLiveness(null);
    setMatches([]);
    setFrameCount(0);
    setBackendStatus("idle");
  }, []);

  // ── Capture & Send Frame ────────────────────────────────────────
  const captureAndSend = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8)
    );

    if (!blob) return;

    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");
    formData.append("source_id", SOURCE_ID);
    formData.append("check_ppe", String(checkPPE));

    try {
      setIsProcessing(true);
      const res = await fetch(`${API_BASE}/recognize_frame`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: RecognitionResponse = await res.json();
      setLiveness(data.liveness);
      setMatches(data.matches);
      setFrameCount((c) => c + 1);
      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
      setBackendStatus("connected");
    } catch (err) {
      console.error("Frame send error:", err);
      setBackendStatus("error");
    } finally {
      setIsProcessing(false);
    }
  }, [checkPPE]); // Add checkPPE dependency

  // ── Start / Stop Streaming ──────────────────────────────────────
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsStreaming(false);
      toast.info("Streaming stopped");
    } else {
      captureAndSend();
      intervalRef.current = setInterval(captureAndSend, captureInterval);
      setIsStreaming(true);
      toast.success("Streaming started");
    }
  }, [isStreaming, captureAndSend, captureInterval]);

  // ── Reset Liveness ──────────────────────────────────────────────
  const resetLiveness = useCallback(async () => {
    try {
      const formData = new FormData();
      formData.append("source_id", SOURCE_ID);
      await fetch(`${API_BASE}/reset_liveness`, {
        method: "POST",
        body: formData,
      });
      setLiveness(null);
      toast.success("Liveness reset");
    } catch {
      toast.error("Failed to reset liveness");
    }
  }, []);

  // ── Update interval while streaming ─────────────────────────────
  useEffect(() => {
    if (isStreaming && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(captureAndSend, captureInterval);
    }
  }, [captureInterval, isStreaming, captureAndSend]);

  // ── Cleanup on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Derived state ───────────────────────────────────────────────
  const verifiedMatch = matches.find(
    (m) => {
      const basicCheck = m.id && m.score > 0.6 && liveness?.is_alive;
      // If PPE check is enabled, also require compliance
      if (checkPPE && m.ppe) {
         return basicCheck && m.ppe.compliant;
      }
      return basicCheck;
    }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ScanFace className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Attendance Camera
          </h1>
          <p className="text-sm text-muted-foreground">
            ESP32 camera simulator — stream webcam frames for face recognition
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Video Panel ─────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative rounded-xl border bg-card overflow-hidden shadow-md">
            {/* Video Container */}
            <div className="relative aspect-[4/3] bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Camera Off Placeholder */}
              {!isCameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 gap-3">
                  <CameraOff className="h-16 w-16 text-muted-foreground/40" />
                  <span className="text-muted-foreground text-sm">
                    Camera is off
                  </span>
                </div>
              )}

              {/* Scanning Overlay */}
              {isStreaming && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Corner brackets */}
                  <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-primary/60 rounded-tl-lg" />
                  <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-primary/60 rounded-tr-lg" />
                  <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-primary/60 rounded-bl-lg" />
                  <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-primary/60 rounded-br-lg" />

                  {/* Scan line animation */}
                  <motion.div
                    className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                    animate={{ top: ["10%", "90%", "10%"] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              )}

              {/* Verified Banner */}
              <AnimatePresence>
                {verifiedMatch && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-4 left-4 right-4"
                  >
                    <div className="flex items-center gap-3 rounded-lg bg-emerald-500/90 backdrop-blur-sm px-4 py-3 text-white shadow-lg">
                      <ShieldCheck className="h-6 w-6 shrink-0" />
                      <div>
                        <p className="font-semibold text-sm">
                          Identity Verified
                        </p>
                        <p className="text-xs text-white/80">
                          {verifiedMatch.name} • Score:{" "}
                          {(verifiedMatch.score * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status Badge */}
              {isStreaming && (
                <div className="absolute top-4 right-16 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      backendStatus === "connected"
                        ? "bg-emerald-400 animate-pulse"
                        : backendStatus === "error"
                        ? "bg-red-400"
                        : "bg-amber-400"
                    }`}
                  />
                  <span className="text-xs text-white/80">
                    {backendStatus === "connected"
                      ? `Frame #${frameCount}`
                      : backendStatus === "error"
                      ? "Backend Error"
                      : "Connecting…"}
                  </span>
                </div>
              )}

              {/* Processing Indicator */}
              {isProcessing && (
                <div className="absolute top-4 left-4">
                  <div className="h-3 w-3 rounded-full bg-amber-400 animate-ping" />
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center gap-4 p-4 border-t bg-card">
              {!isCameraOn ? (
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                  Start Camera
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleStreaming}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      isStreaming
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {isStreaming ? (
                      <>
                        <CameraOff className="h-4 w-4" />
                        Stop Streaming
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4" />
                        Start Streaming
                      </>
                    )}
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                  >
                    <CameraOff className="h-4 w-4" />
                    Turn Off
                  </button>
                </>
              )}
                
                {/* PPE Toggle */}
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={checkPPE}
                            onChange={(e) => setCheckPPE(e.target.checked)}
                            className="w-4 h-4 accent-primary rounded cursor-pointer"
                        />
                        <span className="text-sm font-medium text-foreground">PPE Check</span>
                    </label>
                </div>

              {/* Interval Slider */}
              <div className="ml-auto flex items-center gap-3">
                <label className="text-xs text-muted-foreground whitespace-nowrap">
                  <Gauge className="h-3.5 w-3.5 inline mr-1" />
                  {captureInterval}ms
                </label>
                <input
                  type="range"
                  min={250}
                  max={2000}
                  step={50}
                  value={captureInterval}
                  onChange={(e) => setCaptureInterval(Number(e.target.value))}
                  className="w-24 accent-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Results Panel ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Liveness Card */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Liveness Detection</h2>
              <button
                onClick={resetLiveness}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </button>
            </div>

            {liveness ? (
              <div className="space-y-3">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {liveness.is_alive ? (
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5"
                    >
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Alive
                      </span>
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1.5">
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Checking…
                      </span>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Blinks
                      </span>
                    </div>
                    <p className="text-xl font-bold">
                      {liveness.details.blinks}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">EAR</span>
                    </div>
                    <p className="text-xl font-bold">
                      {liveness.details.ear.toFixed(3)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {liveness.details.status}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Start streaming to see liveness data
              </p>
            )}
          </div>

          {/* Recognized Faces Card */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Recognized Faces</h2>
              {lastUpdated && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {lastUpdated}
                </span>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {matches.length > 0 ? (
                <div className="space-y-2">
                  {matches.map((match, i) => {
                    const isRecognized = match.id !== null && match.score > 0.6;
                    let isCompliant = true;
                    // Check compliance only if toggle is on
                    if (checkPPE && match.ppe) {
                        isCompliant = match.ppe.compliant;
                    }
                    
                    const isVerified = isRecognized && isCompliant;
                    
                    return (
                      <motion.div
                        key={`${match.id || "unknown"}-${i}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex flex-col gap-2 rounded-lg border p-3 ${
                          isVerified
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : isRecognized && !isCompliant
                                ? "border-destructive/20 bg-destructive/5"
                            : "border-border bg-muted/30"
                        }`}
                      >
                       <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            isVerified
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : isRecognized && !isCompliant
                                ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isRecognized && !isCompliant ? <ShieldAlert className="h-4 w-4"/> : <User className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              isVerified ? "" : isRecognized && !isCompliant ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            {isRecognized ? match.name : "Unknown Person"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {match.id
                              ? `ID: ${match.id}`
                              : "No match in database"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={`text-sm font-bold ${
                              isVerified
                                ? "text-emerald-600 dark:text-emerald-400"
                                : isRecognized && !isCompliant 
                                    ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {(match.score * 100).toFixed(1)}%
                          </p>
                        </div>
                       </div>
                       
                       {/* PPE Status display */}
                       {checkPPE && match.ppe && !isCompliant && (
                           <div className="text-xs text-destructive mt-1 pl-12">
                               <p className="font-semibold">Missing Safety Gear:</p>
                               <ul className="list-disc pl-4 mt-1">
                                   {!match.ppe.hard_hat && <li>Hard Hat</li>}
                                   {!match.ppe.vest && <li>Safety Vest</li>}
                               </ul>
                           </div>
                       )}
                       
                       {checkPPE && match.ppe && isCompliant && isRecognized && (
                           <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 pl-12 flex items-center gap-1">
                               <ShieldCheck className="h-3 w-3" />
                               <span>Safety Gear Verified</span>
                           </div>
                       )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <ScanFace className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No faces detected yet</p>
                  <p className="text-xs">
                    Start streaming to begin recognition
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Connection Status */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Backend</span>
              <span
                className={`flex items-center gap-1.5 font-medium ${
                  backendStatus === "connected"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : backendStatus === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    backendStatus === "connected"
                      ? "bg-emerald-500"
                      : backendStatus === "error"
                      ? "bg-destructive"
                      : "bg-muted-foreground"
                  }`}
                />
                {backendStatus === "connected"
                  ? "Connected"
                  : backendStatus === "error"
                  ? "Disconnected"
                  : "Idle"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-muted-foreground">Endpoint</span>
              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                {API_BASE}/recognize_frame
              </code>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-muted-foreground">Frames sent</span>
              <span className="font-medium">{frameCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
