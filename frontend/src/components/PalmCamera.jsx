import { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CameraOff, Hand, AlertCircle } from "lucide-react";
import clsx from "clsx";

export default function PalmCamera({
  onCapture,
  mode = "capture",
  captureCount = 0,
  maxCaptures = 5,
  autoPredict = false,
}) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const handsRef   = useRef(null);
  const streamRef  = useRef(null);
  const timerRef   = useRef(null);

  const [active,   setActive]   = useState(false);
  const [detected, setDetected] = useState(false);
  const [error,    setError]    = useState("");
  const [starting, setStarting] = useState(false);

  /* ── Capture frame (IMPROVED) ───────────────────────────── */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState !== 4) return null;

    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.9); // better quality
  }, []);

  /* ── MediaPipe result handler ───────────────────────────── */
  const onResults = useCallback((results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hasHand = !!(results.multiHandLandmarks?.length);
    setDetected(hasHand);

    if (hasHand && window.drawConnectors && window.drawLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
          color: "#6366f1",
          lineWidth: 2,
        });
        window.drawLandmarks(ctx, landmarks, {
          color: "#a5b4fc",
          fillColor: "#6366f1",
          lineWidth: 1,
          radius: 4,
        });
      }
    }
  }, []);

  /* ── Start camera (IMPROVED) ───────────────────────────── */
  const startCamera = useCallback(async () => {
    setStarting(true);
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      if (window.Hands) {
        const hands = new window.Hands({
          locateFile: (f) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.4,  // 🔥 easier detection
          minTrackingConfidence: 0.5,
        });

        hands.onResults(onResults);

        const processFrame = async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            await hands.send({ image: videoRef.current });
          }
          timerRef.current = requestAnimationFrame(processFrame);
        };

        timerRef.current = requestAnimationFrame(processFrame);
        handsRef.current = hands;
      }

      setActive(true);

    } catch (e) {
      setError("Camera access denied. Please allow camera permissions.");
    } finally {
      setStarting(false);
    }
  }, [onResults]);

  /* ── Stop camera ───────────────────────────────────────── */
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());

    if (videoRef.current) videoRef.current.srcObject = null;

    handsRef.current = null;
    setActive(false);
    setDetected(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  /* ── Auto predict (IMPROVED) ───────────────────────────── */
  useEffect(() => {
    if (!autoPredict || !active || !detected || mode !== "predict") return;

    const id = setTimeout(() => {
      const frame = captureFrame();
      if (frame) onCapture?.(frame);
    }, 1000);

    return () => clearTimeout(id);
  }, [autoPredict, active, detected, mode, captureFrame, onCapture]);

  /* ── Capture button (IMPROVED) ─────────────────────────── */
  const handleCapture = () => {
    if (!active || !detected) return;

    setTimeout(() => {
      const frame = captureFrame();
      if (frame) onCapture?.(frame);
    }, 400);
  };

  const canCapture =
    active && detected && (mode === "predict" || captureCount < maxCaptures);

  return (
    <div className="space-y-4">
      {/* Camera */}
      <div className="relative aspect-video bg-surface-200 rounded-2xl overflow-hidden border border-white/10">
        <video
          ref={videoRef}
          className="w-full h-full object-cover scale-x-[-1]"
          playsInline
          muted
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full scale-x-[-1]"
          width={1280}
          height={720}
        />

        {/* Status */}
        {active && (
          <div className={clsx(
            "absolute top-3 left-3 badge text-xs font-bold px-3 py-1",
            detected ? "badge-green" : "badge-red"
          )}>
            {detected ? "✋ Palm Detected" : "Move hand closer"}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        {!active ? (
          <button onClick={startCamera} className="btn-primary flex-1">
            <Camera size={16} />
            {starting ? "Starting..." : "Start Camera"}
          </button>
        ) : (
          <>
            <button onClick={stopCamera} className="btn-secondary">
              <CameraOff size={16} />
              Stop
            </button>

            <button
              onClick={handleCapture}
              disabled={!canCapture}
              className={clsx(
                "btn flex-1",
                canCapture
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-300 cursor-not-allowed"
              )}
            >
              <Hand size={16} />
              {mode === "predict" ? "Scan Palm" : "Capture"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}