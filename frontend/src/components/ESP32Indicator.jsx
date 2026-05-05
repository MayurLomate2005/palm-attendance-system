import { useEffect, useState } from "react";
import { Zap, Lock, Unlock } from "lucide-react";
import clsx from "clsx";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function ESP32Indicator({ trigger, userName, confidence }) {
  const [state, setState]     = useState("idle");   // idle | unlocking | unlocked | denied
  const [lastTs, setLastTs]   = useState(null);

  useEffect(() => {
    if (!trigger) return;
    if (trigger === "granted") {
      setState("unlocking");
      api.post("/esp32/unlock", { reason: "palm_auth" })
        .then(({ data }) => {
          setState("unlocked");
          setLastTs(data.timestamp);
          toast.success("🔓 Door Unlocked!");
          setTimeout(() => setState("idle"), 5000);
        })
        .catch(() => {
          setState("denied");
          setTimeout(() => setState("idle"), 3000);
        });
    } else if (trigger === "denied") {
      setState("denied");
      setTimeout(() => setState("idle"), 3000);
    }
  }, [trigger]);

  const config = {
    idle:      { bg: "bg-surface-200",          led: "bg-slate-600",  text: "Standby",        icon: Lock,   border: "border-white/10" },
    unlocking: { bg: "bg-amber-500/10",          led: "bg-amber-400 animate-pulse", text: "Processing…", icon: Zap,    border: "border-amber-500/30" },
    unlocked:  { bg: "bg-emerald-500/10",        led: "bg-emerald-400 animate-pulse-slow", text: "ACCESS GRANTED", icon: Unlock, border: "border-emerald-500/30" },
    denied:    { bg: "bg-red-500/10",            led: "bg-red-500 animate-pulse", text: "ACCESS DENIED",  icon: Lock,   border: "border-red-500/30" },
  };
  const { bg, led, text, icon: Icon, border } = config[state];

  return (
    <div className={clsx("card border transition-all duration-500", bg, border)}>
      <div className="flex items-center gap-4">
        {/* LED Indicator */}
        <div className="relative">
          <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center bg-surface-200")}>
            <Icon size={22} className={clsx(
              state === "unlocked" ? "text-emerald-400" :
              state === "denied"   ? "text-red-400"     :
              state === "unlocking"? "text-amber-400"   : "text-slate-500"
            )} />
          </div>
          <span className={clsx("absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface-100", led)} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={clsx("text-sm font-bold tracking-wide",
            state === "unlocked" ? "text-emerald-400" :
            state === "denied"   ? "text-red-400"     :
            state === "unlocking"? "text-amber-400"   : "text-slate-400"
          )}>
            {text}
          </p>
          {userName && state === "unlocked" && (
            <p className="text-xs text-slate-400 truncate">Welcome, {userName}!</p>
          )}
          {confidence && state === "unlocked" && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${(confidence * 100).toFixed(0)}%` }}
                />
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">
                {(confidence * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {lastTs && state === "unlocked" && (
            <p className="text-[10px] text-slate-600 mt-0.5 font-mono">
              {new Date(lastTs).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Simulated ESP32 chip label */}
        <div className="hidden sm:flex flex-col items-end gap-1">
          <span className="text-[9px] text-slate-600 uppercase tracking-widest font-mono">ESP32</span>
          <span className="text-[9px] text-slate-600 uppercase tracking-widest font-mono">Simulated</span>
          <div className={clsx("w-6 h-1.5 rounded-full", led.split(" ")[0])} />
        </div>
      </div>
    </div>
  );
}
