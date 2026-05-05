import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar  from "../components/Sidebar";
import Navbar   from "../components/Navbar";
import StatCard from "../components/StatCard";
import AttendanceTable from "../components/AttendanceTable";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  PlayCircle, StopCircle, Users, UserCheck, UserX,
  ClipboardList, PenLine, Download, RefreshCw,
} from "lucide-react";
import clsx from "clsx";

export default function TeacherDashboard() {
  const [tab,        setTab]        = useState("session");
  const [session,    setSession]    = useState(false);
  const [records,    setRecords]    = useState([]);
  const [students,   setStudents]   = useState([]);
  const [classData,  setClassData]  = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [manualForm, setManualForm] = useState({ user_id: "", status: "present", session_label: "" });
  const refreshTimer = useRef(null);

  const loadToday = useCallback(async () => {
    try {
      const { data } = await api.get("/attendance/today");
      setRecords(data.records);
    } catch {}
  }, []);

  const loadClassView = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/attendance/class");
      setClassData(data);
    } catch { toast.error("Failed to load class data"); }
    finally { setLoading(false); }
  }, []);

  const loadStudents = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/users?role=student");
      setStudents(data.users);
    } catch {}
  }, []);

  useEffect(() => {
    loadStudents();
    loadToday();
  }, [loadStudents, loadToday]);

  /* Auto-refresh live attendance every 10s when session is active */
  useEffect(() => {
    if (session) {
      refreshTimer.current = setInterval(loadToday, 10000);
    } else {
      clearInterval(refreshTimer.current);
    }
    return () => clearInterval(refreshTimer.current);
  }, [session, loadToday]);

  useEffect(() => {
    if (tab === "class") loadClassView();
  }, [tab, loadClassView]);

  const toggleSession = () => {
    setSession((s) => !s);
    toast(session ? "Session ended" : "Session started — monitoring live", {
      icon: session ? "🔴" : "🟢",
    });
  };

  const submitManual = async (e) => {
    e.preventDefault();
    if (!manualForm.user_id) return toast.error("Select a student");
    try {
      await api.put("/attendance/manual", manualForm);
      toast.success("Attendance marked manually");
      loadToday();
      setManualForm({ user_id: "", status: "present", session_label: "" });
    } catch (e) { toast.error(e.response?.data?.error || "Failed to mark"); }
  };

  const exportCSV = () => {
    if (!records.length) return toast.error("No records to export");
    const header = "Student,Date,Time,Status,Method,Confidence\n";
    const rows   = records.map((r) =>
      `"${r.user_name}",${r.date},${r.time},${r.status},${r.method},${r.confidence ?? ""}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `attendance_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount  = Math.max(0, students.length - presentCount);

  const tabs = [
    { id: "session", icon: PlayCircle,    label: "Live Session" },
    { id: "manual",  icon: PenLine,       label: "Manual Mark"  },
    { id: "class",   icon: ClipboardList, label: "Class View"   },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <Navbar title="Teacher Dashboard" onRefresh={loadToday} loading={loading} />

        <div className="px-6 pt-4 border-b border-white/5 flex gap-1">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx("flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all",
                tab === id ? "bg-surface-100 text-brand-400 border-b-2 border-brand-500"
                           : "text-slate-500 hover:text-slate-300")}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        <main className="flex-1 p-6 space-y-6 animate-fade-in">

          {/* ── LIVE SESSION ──────────────────────────────────────────── */}
          {tab === "session" && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <StatCard title="Total Students" value={students.length}
                  icon={Users}     color="brand"   />
                <StatCard title="Present Today"  value={presentCount}
                  icon={UserCheck} color="emerald" />
                <StatCard title="Absent"         value={absentCount}
                  icon={UserX}     color="red"     />
              </div>

              {/* Session control */}
              <div className={clsx("card border flex items-center justify-between transition-colors",
                session ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/5")}>
                <div className="flex items-center gap-3">
                  <div className={clsx("w-3 h-3 rounded-full",
                    session ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
                  <div>
                    <p className="font-semibold text-white">
                      {session ? "Session Active" : "Session Inactive"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {session ? "Live attendance is being tracked. Auto-refreshing every 10s."
                               : "Start session to begin monitoring attendance."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={loadToday} className="btn-secondary">
                    <RefreshCw size={15} /> Refresh
                  </button>
                  <button onClick={exportCSV} className="btn-secondary">
                    <Download size={15} /> Export
                  </button>
                  <button onClick={toggleSession}
                    className={session ? "btn-danger" : "btn-success"}>
                    {session ? <><StopCircle size={15}/>End Session</>
                              : <><PlayCircle size={15}/>Start Session</>}
                  </button>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-white mb-4">
                  Today's Attendance — {new Date().toLocaleDateString()}
                </h3>
                <AttendanceTable records={records} loading={loading} />
              </div>
            </>
          )}

          {/* ── MANUAL MARK ───────────────────────────────────────────── */}
          {tab === "manual" && (
            <div className="max-w-md">
              <div className="card space-y-5">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <PenLine size={18} className="text-brand-400" />
                  Manual Attendance Override
                </h3>
                <form onSubmit={submitManual} className="space-y-4">
                  <div>
                    <label className="label">Student</label>
                    <select
                      value={manualForm.user_id}
                      onChange={(e) => setManualForm((p) => ({ ...p, user_id: e.target.value }))}
                      className="input">
                      <option value="">— Select student —</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} {s.student_id ? `(${s.student_id})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      value={manualForm.status}
                      onChange={(e) => setManualForm((p) => ({ ...p, status: e.target.value }))}
                      className="input">
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Session Label (optional)</label>
                    <input value={manualForm.session_label}
                      onChange={(e) => setManualForm((p) => ({ ...p, session_label: e.target.value }))}
                      placeholder="e.g. CS101 Morning"
                      className="input" />
                  </div>
                  <button type="submit" className="btn-primary w-full justify-center">
                    <PenLine size={15} /> Mark Attendance
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── CLASS VIEW ────────────────────────────────────────────── */}
          {tab === "class" && classData && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <StatCard title="Total"   value={classData.total_students} icon={Users}     color="brand"   />
                <StatCard title="Present" value={classData.present_count}  icon={UserCheck} color="emerald" />
                <StatCard title="Absent"  value={classData.absent_count}   icon={UserX}     color="red"     />
              </div>
              <div className="card">
                <h3 className="font-semibold text-white mb-4">Present Students</h3>
                <AttendanceTable records={classData.records} loading={loading} />
              </div>
              {classData.absent_students?.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-white mb-4">
                    Absent Students ({classData.absent_students.length})
                  </h3>
                  <div className="space-y-2">
                    {classData.absent_students.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center
                                        justify-center text-xs font-bold text-red-400">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                        <span className="ml-auto badge badge-red">Absent</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
