import { useState, useEffect, useRef, useCallback } from "react";
import { Shield, CheckCircle2, XCircle, Clock, Users, Wifi, WifiOff, Hand } from "lucide-react";
import clsx from "clsx";

const API_BASE = "http://127.0.0.1:5000/api";

// ── Helpers ─────────────────────────────────────────────────────────────────

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatTime(d) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDate(d) {
  return d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function KioskPage() {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const handsRef    = useRef(null);
  const timerRef    = useRef(null);
  const scanTimer   = useRef(null);
  const isScanning  = useRef(false);

  const now = useClock();

  const [cameraActive, setCameraActive] = useState(false);
  const [detected,     setDetected]     = useState(false);
  const [cameraError,  setCameraError]  = useState("");
  const [result,       setResult]       = useState(null);   // last auth result
  const [recentLog,    setRecentLog]    = useState([]);     // rolling log
  const [serverOnline, setServerOnline] = useState(false);
  const [resultTimer,  setResultTimer]  = useState(null);

  // ── Check server health ────────────────────────────────────────────────────
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        setServerOnline(res.ok);
      } catch { setServerOnline(false); }
    };
    checkHealth();
    const id = setInterval(checkHealth, 10000);
    return () => clearInterval(id);
  }, []);

  // ── Load recent log ────────────────────────────────────────────────────────
  const loadRecent = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/kiosk/recent`);
      const data = await res.json();
      if (data.records) setRecentLog(data.records);
    } catch {}
  }, []);

  useEffect(() => {
    loadRecent();
    const id = setInterval(loadRecent, 15000);
    return () => clearInterval(id);
  }, [loadRecent]);

  // ── MediaPipe hand overlay ─────────────────────────────────────────────────
  const onResults = useCallback((results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hasHand = !!(results.multiHandLandmarks?.length);
    setDetected(hasHand);
    if (hasHand && window.drawConnectors && window.drawLandmarks) {
      for (const lms of results.multiHandLandmarks) {
        window.drawConnectors(ctx, lms, window.HAND_CONNECTIONS, { color: "#6366f1", lineWidth: 3 });
        window.drawLandmarks(ctx, lms, { color: "#a5b4fc", fillColor: "#6366f1", lineWidth: 1, radius: 5 });
      }
    }
  }, []);

  // ── Start camera ───────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      if (window.Hands) {
        const hands = new window.Hands({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.4, minTrackingConfidence: 0.5 });
        hands.onResults(onResults);
        const process = async () => {
          if (videoRef.current?.readyState === 4) await hands.send({ image: videoRef.current });
          timerRef.current = requestAnimationFrame(process);
        };
        timerRef.current = requestAnimationFrame(process);
        handsRef.current = hands;
      }
      setCameraActive(true);
    } catch {
      setCameraError("Camera access denied. Please allow camera and reload.");
    }
  }, [onResults]);

  // ── Auto-start camera on mount ─────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(startCamera, 800);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(timerRef.current);
      clearInterval(scanTimer.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [startCamera]);

  // ── Capture frame ──────────────────────────────────────────────────────────
  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.readyState !== 4) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.9);
  }, []);

  // ── Send scan to backend ───────────────────────────────────────────────────
  const sendScan = useCallback(async () => {
    if (isScanning.current) return;
    const frame = captureFrame();
    if (!frame) return;
    isScanning.current = true;
    try {
      const res  = await fetch(`${API_BASE}/kiosk/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: frame }),
      });
      const data = await res.json();

      if (data.status === "no_hand") { isScanning.current = false; return; }

      setResult(data);

      if (data.status === "granted") {
        loadRecent();
        if (resultTimer) clearTimeout(resultTimer);
        setResultTimer(setTimeout(() => setResult(null), 5000));
      } else if (data.status === "denied") {
        if (resultTimer) clearTimeout(resultTimer);
        setResultTimer(setTimeout(() => setResult(null), 3000));
      }
    } catch {}
    finally { setTimeout(() => { isScanning.current = false; }, 2500); }
  }, [captureFrame, loadRecent, resultTimer]);

  // ── Auto-scan every 2.5 s when hand is detected ────────────────────────────
  useEffect(() => {
    if (!cameraActive) return;
    scanTimer.current = setInterval(() => {
      if (detected) sendScan();
    }, 2500);
    return () => clearInterval(scanTimer.current);
  }, [cameraActive, detected, sendScan]);

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col overflow-hidden select-none">

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-[#0d0d14]">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600
                          flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Hand size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">PalmID</h1>
            <p className="text-[11px] text-indigo-400 uppercase tracking-widest font-semibold">
              Biometric Attendance System
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-3xl font-black text-white font-mono tracking-tight">{formatTime(now)}</p>
          <p className="text-xs text-slate-400">{formatDate(now)}</p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {serverOnline
            ? <><Wifi size={16} className="text-emerald-400" /><span className="text-emerald-400 font-semibold">System Online</span></>
            : <><WifiOff size={16} className="text-red-400" /><span className="text-red-400 font-semibold">Server Offline</span></>
          }
        </div>
      </header>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 gap-0 overflow-hidden">

        {/* Camera Panel */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">

          {/* Instruction */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-1">Place Your Palm on Camera</h2>
            <p className="text-slate-500 text-sm">Hold your palm flat and steady. Recognition is automatic.</p>
          </div>

          {/* Camera viewport */}
          <div className={clsx(
            "relative rounded-3xl overflow-hidden border-2 transition-all duration-500 shadow-2xl",
            "w-full max-w-2xl aspect-video",
            detected
              ? result?.status === "granted"
                ? "border-emerald-500 shadow-emerald-500/30"
                : result?.status === "denied"
                  ? "border-red-500 shadow-red-500/30"
                  : "border-indigo-500 shadow-indigo-500/20"
              : "border-white/10"
          )}>
            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full scale-x-[-1]" width={1280} height={720} />

            {/* Detection badge */}
            {cameraActive && (
              <div className={clsx(
                "absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold",
                detected ? "bg-indigo-600/90 text-white" : "bg-black/60 text-slate-400"
              )}>
                <div className={clsx("w-2 h-2 rounded-full", detected ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
                {detected ? "Palm Detected — Scanning…" : "Waiting for palm…"}
              </div>
            )}

            {/* Camera error overlay */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
                <XCircle size={48} className="text-red-400" />
                <p className="text-red-400 text-center max-w-xs text-sm font-medium">{cameraError}</p>
                <button onClick={startCamera}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors">
                  Retry Camera
                </button>
              </div>
            )}

            {/* Scanning animation ring */}
            {detected && !result && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border-2 border-indigo-400/40 animate-ping" />
              </div>
            )}
          </div>

          {/* Result Card */}
          {result && result.status !== "no_hand" && result.status !== "error" && (
            <div className={clsx(
              "w-full max-w-2xl rounded-2xl p-6 border-2 transition-all animate-fade-in",
              result.status === "granted"
                ? "bg-emerald-500/10 border-emerald-500/40"
                : "bg-red-500/10 border-red-500/40"
            )}>
              <div className="flex items-center gap-5">
                <div className={clsx(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0",
                  result.status === "granted" ? "bg-emerald-500/20" : "bg-red-500/20"
                )}>
                  {result.status === "granted" ? <CheckCircle2 size={32} className="text-emerald-400" /> : <XCircle size={32} className="text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx("text-3xl font-black truncate",
                    result.status === "granted" ? "text-emerald-400" : "text-red-400")}>
                    {result.status === "granted"
                      ? result.already_marked ? "Already Marked Today" : `Welcome, ${result.user_name}!`
                      : "Access Denied"}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {result.status === "granted"
                      ? result.already_marked
                        ? `${result.user_name} — attendance already recorded for today`
                        : `Attendance marked at ${result.time} — Confidence: ${(result.confidence * 100).toFixed(1)}%`
                      : "Palm not recognised. Please try again or contact admin."}
                  </p>
                </div>
                {result.status === "granted" && result.student_id && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Student ID</p>
                    <p className="text-white font-mono font-bold text-lg">{result.student_id}</p>
                  </div>
                )}
              </div>

              {/* Confidence bar */}
              {result.confidence !== undefined && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Confidence</span>
                    <span className="font-mono">{(result.confidence * 100).toFixed(2)}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={clsx("h-full rounded-full transition-all duration-700",
                        result.status === "granted" ? "bg-emerald-400" : "bg-red-400")}
                      style={{ width: `${(result.confidence * 100).toFixed(0)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL — Recent Log ─────────────────────────────────── */}
        <aside className="w-80 border-l border-white/5 bg-[#0d0d14] flex flex-col">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-indigo-400" />
              <h3 className="font-bold text-white text-sm">Today's Attendance</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Last 10 authenticated students</p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {recentLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600 p-6">
                <Shield size={32} className="opacity-30" />
                <p className="text-sm text-center">No attendance recorded yet today.</p>
              </div>
            ) : recentLog.map((r, i) => (
              <div key={i} className="px-5 py-4 hover:bg-white/2 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center
                                  text-indigo-300 font-bold text-sm shrink-0">
                    {r.user_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{r.user_name}</p>
                    {r.student_id && (
                      <p className="text-slate-600 text-xs font-mono">{r.student_id}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-emerald-400">
                      <Clock size={11} />
                      <span className="text-xs font-mono">{r.time}</span>
                    </div>
                    {r.confidence && (
                      <p className="text-[10px] text-slate-600 font-mono">
                        {(r.confidence * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-700 uppercase tracking-widest">PalmID v2.0 • Real-Time Biometric</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
