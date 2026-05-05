import { useState, useEffect, useCallback } from "react";
import Sidebar   from "../components/Sidebar";
import Navbar    from "../components/Navbar";
import StatCard  from "../components/StatCard";
import PalmCamera from "../components/PalmCamera";
import AttendanceTable from "../components/AttendanceTable";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Hand, ClipboardList, CheckCircle2,
  AlertTriangle, Info, Calendar, BarChart3,
  TrendingUp, Award,
} from "lucide-react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import clsx from "clsx";

// ── Attendance calendar heatmap ──────────────────────────────────────────────
function CalendarHeatmap({ records }) {
  const today = new Date();
  const days  = [];

  // Build last 35 days (5 weeks)
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    const rec = records.find(r => r.date === iso);
    days.push({ date: iso, status: rec?.status ?? "absent_day",
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) });
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-400 mb-3">Last 35 Days</h4>
      <div className="grid grid-cols-7 gap-1.5">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="text-[10px] text-slate-600 text-center font-semibold pb-1">{d}</div>
        ))}
        {days.map(({ date, status, label }) => (
          <div key={date}
            title={`${label} — ${status === "present" ? "Present" : "Absent"}`}
            className={clsx(
              "aspect-square rounded-md transition-all cursor-default group relative",
              status === "present"  ? "bg-emerald-500/80 hover:bg-emerald-400"
            : status === "absent"   ? "bg-red-500/40 hover:bg-red-500/60"
            : "bg-white/5 hover:bg-white/10"
            )}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block
                            bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
              {label}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500/80"/><span className="text-xs text-slate-500">Present</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500/40"/><span className="text-xs text-slate-500">Absent</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-white/5"/><span className="text-xs text-slate-500">No class</span></div>
      </div>
    </div>
  );
}

// ── Monthly bar chart ────────────────────────────────────────────────────────
function MonthlyChart({ records }) {
  const monthMap = {};
  records.forEach(r => {
    if (!r.date) return;
    const key = r.date.slice(0, 7); // "YYYY-MM"
    if (!monthMap[key]) monthMap[key] = { present: 0, absent: 0 };
    if (r.status === "present") monthMap[key].present++;
    else monthMap[key].absent++;
  });

  const data = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, val]) => ({
      month: new Date(key + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      present: val.present,
      absent: val.absent,
      pct: val.present + val.absent > 0
        ? Math.round((val.present / (val.present + val.absent)) * 100) : 0,
    }));

  if (!data.length) return (
    <div className="flex items-center justify-center h-40 text-slate-600 text-sm">No data yet</div>
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
        <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1e1e2e", border: "1px solid #ffffff10", borderRadius: "12px", color: "#fff" }}
          cursor={{ fill: "#ffffff05" }}
          formatter={(v, n) => [v, n === "present" ? "Present" : "Absent"]}
        />
        <Bar dataKey="present" radius={[4,4,0,0]} fill="#34d399" maxBarSize={32} />
        <Bar dataKey="absent"  radius={[4,4,0,0]} fill="#f87171" maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Yearly summary ───────────────────────────────────────────────────────────
function YearlySummary({ records }) {
  const currentYear = new Date().getFullYear();
  const yearRecords = records.filter(r => r.date?.startsWith(String(currentYear)));
  const present = yearRecords.filter(r => r.status === "present").length;
  const total   = yearRecords.length;
  const pct     = total ? Math.round((present / total) * 100) : 0;

  const grade = pct >= 90 ? { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/10" }
              : pct >= 75 ? { label: "Good", color: "text-blue-400", bg: "bg-blue-500/10" }
              : pct >= 60 ? { label: "Average", color: "text-amber-400", bg: "bg-amber-500/10" }
              : { label: "Poor — At Risk", color: "text-red-400", bg: "bg-red-500/10" };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-black text-white">{total}</p>
          <p className="text-xs text-slate-500 mt-1">Total Classes</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-black text-emerald-400">{present}</p>
          <p className="text-xs text-slate-500 mt-1">Present</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-black text-red-400">{total - present}</p>
          <p className="text-xs text-slate-500 mt-1">Absent</p>
        </div>
      </div>

      <div className={clsx("card flex items-center gap-5", grade.bg)}>
        <Award size={36} className={grade.color} />
        <div>
          <p className={clsx("text-2xl font-black", grade.color)}>{pct}% Attendance</p>
          <p className="text-sm text-slate-400">{currentYear} Academic Year — <span className={grade.color}>{grade.label}</span></p>
        </div>
      </div>

      {pct < 75 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Attendance Below 75%</p>
            <p className="text-xs mt-0.5 text-red-400/70">
              You need {Math.ceil((0.75 * total - present) / 0.25)} more classes to reach 75%.
              Contact your teacher immediately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Student Dashboard ───────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user, refreshUser } = useAuth();
  const [tab,        setTab]        = useState("overview");
  const [subTab,     setSubTab]     = useState("daily");
  const [palmStatus, setPalmStatus] = useState(null);
  const [history,    setHistory]    = useState(null);
  const [capturing,  setCapturing]  = useState(false);
  const [loading,    setLoading]    = useState(false);

  const loadPalmStatus = useCallback(async () => {
    try { const { data } = await api.get("/palm/status"); setPalmStatus(data); } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/attendance/student/${user.id}`);
      setHistory(data);
    } catch { toast.error("Failed to load attendance history"); }
    finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { loadPalmStatus(); loadHistory(); }, [loadPalmStatus, loadHistory]);

  const handleCapture = async (b64) => {
    if (capturing) return;
    setCapturing(true);
    try {
      const { data } = await api.post("/palm/capture", { image: b64 });
      toast.success(data.message);
      loadPalmStatus();
      await refreshUser();
      if (data.ready) toast("Enough samples captured! Admin can now train the model.",
        { icon: "ℹ️", duration: 5000 });
    } catch (e) {
      if (e.response?.data?.detected === false) toast.error("No palm detected. Show your full palm.");
      else toast.error(e.response?.data?.error || "Capture failed");
    } finally { setCapturing(false); }
  };

  const radialData = history ? [{ value: history.percentage, fill: "#6366f1" }] : [];

  const tabs = [
    { id: "overview",   icon: ClipboardList, label: "Overview" },
    { id: "register",   icon: Hand,          label: "Register Palm" },
    { id: "attendance", icon: Calendar,      label: "My Attendance" },
  ];

  const attendanceTabs = [
    { id: "daily",   icon: Calendar,   label: "Daily" },
    { id: "monthly", icon: BarChart3,  label: "Monthly" },
    { id: "yearly",  icon: TrendingUp, label: "Yearly" },
  ];

  // Today's record
  const todayISO = new Date().toISOString().split("T")[0];
  const todayRecord = history?.records?.find(r => r.date === todayISO);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <Navbar title="Student Portal"
          onRefresh={() => { loadPalmStatus(); loadHistory(); }} loading={loading} />

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-white/5 flex gap-1 overflow-x-auto">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all whitespace-nowrap",
                tab === id ? "bg-surface-100 text-brand-400 border-b-2 border-brand-500"
                           : "text-slate-500 hover:text-slate-300"
              )}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        <main className="flex-1 p-6 space-y-6 animate-fade-in">

          {/* ── OVERVIEW ────────────────────────────────────────────────── */}
          {tab === "overview" && history && (
            <>
              {/* Today's Status Banner */}
              <div className={clsx(
                "rounded-2xl p-5 flex items-center gap-5 border",
                todayRecord
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-amber-500/10 border-amber-500/20"
              )}>
                <div className={clsx(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
                  todayRecord ? "bg-emerald-500/20" : "bg-amber-500/20"
                )}>
                  {todayRecord
                    ? <CheckCircle2 size={28} className="text-emerald-400" />
                    : <AlertTriangle size={28} className="text-amber-400" />}
                </div>
                <div>
                  <p className={clsx("text-lg font-bold",
                    todayRecord ? "text-emerald-400" : "text-amber-400")}>
                    {todayRecord ? "Present Today ✓" : "Not Yet Marked Today"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {todayRecord
                      ? `Marked at ${todayRecord.time} via palm scan — Confidence: ${
                          todayRecord.confidence ? (todayRecord.confidence * 100).toFixed(1) + "%" : "N/A"
                        }`
                      : "Visit the lab and scan your palm at the door to mark attendance."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Days"  value={history.total_days}  icon={ClipboardList} color="brand" />
                <StatCard title="Present"     value={history.present}     icon={CheckCircle2}  color="emerald" />
                <StatCard title="Absent"      value={history.absent}      icon={AlertTriangle} color="red" />
                <StatCard title="Attendance %" value={`${history.percentage}%`} icon={Award}
                  color={history.percentage >= 75 ? "emerald" : history.percentage >= 60 ? "amber" : "red"} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radial chart */}
                <div className="card flex flex-col items-center">
                  <h3 className="font-semibold text-white mb-2 self-start">Attendance Rate</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="80%"
                      data={radialData} startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar background dataKey="value" cornerRadius={8} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <p className={clsx("text-4xl font-black -mt-12",
                    history.percentage >= 75 ? "text-emerald-400" :
                    history.percentage >= 60 ? "text-amber-400"   : "text-red-400")}>
                    {history.percentage}%
                  </p>
                  <p className="text-slate-500 text-sm mt-2">Overall Attendance</p>
                  {history.percentage < 75 && (
                    <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10
                                    border border-amber-500/20 text-amber-400 text-xs w-full">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      Attendance below 75%. Risk of being barred from exams.
                    </div>
                  )}
                </div>

                {/* Palm status */}
                <div className="card space-y-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Hand size={18} className="text-brand-400" /> Palm Registration
                  </h3>
                  {palmStatus && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Samples captured</span>
                        <span className="font-mono text-white font-bold">
                          {palmStatus.count}/{palmStatus.max_allowed}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface-300 rounded-full overflow-hidden">
                        <div className={clsx("h-full rounded-full transition-all duration-500",
                          palmStatus.ready ? "bg-emerald-400" : "bg-brand-500")}
                          style={{ width: `${Math.min(100, (palmStatus.count / palmStatus.max_allowed) * 100)}%` }}
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <span className={palmStatus.ready ? "badge-green badge" : "badge-yellow badge"}>
                          {palmStatus.ready ? "✓ Registration complete"
                            : `Need ${palmStatus.min_required - palmStatus.count} more samples`}
                        </span>
                        <span className={palmStatus.model_ready ? "badge-green badge" : "badge-red badge"}>
                          {palmStatus.model_ready ? "✓ Model trained" : "Model not trained"}
                        </span>
                      </div>
                      {!palmStatus.ready && (
                        <button onClick={() => setTab("register")} className="btn-primary">
                          <Hand size={15} /> Register Palm Now
                        </button>
                      )}
                      {palmStatus.ready && !palmStatus.model_ready && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10
                                        border border-blue-500/20 text-blue-400 text-xs">
                          <Info size={14} className="shrink-0 mt-0.5" />
                          Palm registered. Ask your admin to train the model.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── REGISTER PALM ───────────────────────────────────────────── */}
          {tab === "register" && (
            <div className="max-w-xl space-y-6">
              <div className="card space-y-2">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Hand size={18} className="text-brand-400" /> Palm Registration
                </h3>
                <p className="text-sm text-slate-500">
                  Hold your palm flat, directly in front of the camera.
                  Capture {palmStatus?.min_required ?? 5}+ samples for reliable recognition.
                </p>
                {palmStatus && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                      <div className={clsx("h-full rounded-full transition-all",
                        palmStatus.ready ? "bg-emerald-400" : "bg-brand-500")}
                        style={{ width: `${Math.min(100, (palmStatus.count / palmStatus.max_allowed) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {palmStatus.count}/{palmStatus.max_allowed}
                    </span>
                  </div>
                )}
              </div>

              <div className="card">
                <PalmCamera mode="capture" onCapture={handleCapture}
                  captureCount={palmStatus?.count ?? 0}
                  maxCaptures={palmStatus?.max_allowed ?? 20} />
              </div>

              {palmStatus?.ready && (
                <div className="card border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-400">Registration Complete!</p>
                      <p className="text-xs text-slate-500">
                        {palmStatus.count} samples saved. Ask your admin to train the model.
                        Once trained, just walk up to the door camera — attendance is automatic.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MY ATTENDANCE ────────────────────────────────────────────── */}
          {tab === "attendance" && history && (
            <div className="space-y-6">
              {/* Sub-tabs */}
              <div className="flex gap-2">
                {attendanceTabs.map(({ id, icon: Icon, label }) => (
                  <button key={id} onClick={() => setSubTab(id)}
                    className={clsx(
                      "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all",
                      subTab === id ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                                   : "bg-surface-100 text-slate-400 hover:text-white"
                    )}>
                    <Icon size={15} />{label}
                  </button>
                ))}
              </div>

              {/* Daily view */}
              {subTab === "daily" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Total Days"  value={history.total_days}  icon={ClipboardList} color="brand" />
                    <StatCard title="Present"     value={history.present}     icon={CheckCircle2}  color="emerald" />
                    <StatCard title="Absent"      value={history.absent}      icon={AlertTriangle} color="red" />
                    <StatCard title="Percentage"  value={`${history.percentage}%`} icon={Award}
                      color={history.percentage >= 75 ? "emerald" : history.percentage >= 60 ? "amber" : "red"} />
                  </div>
                  <div className="card">
                    <CalendarHeatmap records={history.records} />
                  </div>
                  <div className="card">
                    <h3 className="font-semibold text-white mb-4">Recent Attendance Log</h3>
                    <AttendanceTable records={history.records.slice(0, 30)} showUser={false} loading={loading} />
                  </div>
                </div>
              )}

              {/* Monthly view */}
              {subTab === "monthly" && (
                <div className="space-y-6">
                  <div className="card">
                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                      <BarChart3 size={18} className="text-brand-400" /> Monthly Attendance
                    </h3>
                    <MonthlyChart records={history.records} />
                  </div>
                  <div className="card">
                    <h3 className="font-semibold text-white mb-4">Full History</h3>
                    <AttendanceTable records={history.records} showUser={false} loading={loading} />
                  </div>
                </div>
              )}

              {/* Yearly view */}
              {subTab === "yearly" && (
                <YearlySummary records={history.records} />
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
