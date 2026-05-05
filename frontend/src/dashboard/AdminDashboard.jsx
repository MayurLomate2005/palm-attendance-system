import { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Users, UserCheck, UserX, BarChart3, Shield,
  Trash2, ToggleLeft, ToggleRight, RefreshCw,
  SlidersHorizontal, Activity, Settings,
  ChevronRight, Fingerprint,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import clsx from "clsx";

const COLORS = ["#6366f1", "#34d399"];

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [threshold, setThreshold] = useState(0.70);
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);

  // ================= LOADERS =================

  const loadAnalytics = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/analytics");
      setAnalytics(data);
    } catch {
      toast.error("Failed to load analytics");
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data.users);
    } catch {
      toast.error("Failed to load users");
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/logs?per_page=30");
      setLogs(data.logs);
    } catch {
      toast.error("Failed to load logs");
    }
  }, []);

  const loadThreshold = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/threshold");
      setThreshold(data.threshold);
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadAnalytics(), loadUsers(), loadThreshold()]);
    setLoading(false);
  }, [loadAnalytics, loadUsers, loadThreshold]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (tab === "logs") loadLogs(); }, [tab, loadLogs]);

  // ================= TRAIN MODEL (FIXED) =================

  const trainModel = async () => {
    setTraining(true);

    try {
      await api.post("/palm/train"); // no stats now
      toast.success("Training started...");
    } catch (e) {
      toast.error(e.response?.data?.error || "Training failed");
      setTraining(false);
    }
  };

  // ================= STATUS POLLING =================

  useEffect(() => {
    let interval;

    if (training) {
      interval = setInterval(async () => {
        try {
          const res = await api.get("/palm/status");

          if (res.data.training_status === "completed") {
            toast.success("Model trained successfully ✅");
            setTraining(false);
            refresh();
            clearInterval(interval);
          }

          if (res.data.training_status === "failed") {
            toast.error("Training failed ❌");
            setTraining(false);
            clearInterval(interval);
          }

        } catch {
          console.log("Status check failed");
        }
      }, 3000);
    }

    return () => clearInterval(interval);
  }, [training, refresh]);

  // ================= USER ACTIONS =================

  const toggleUser = async (uid, current) => {
    try {
      await api.patch(`/admin/users/${uid}`, { is_active: !current });
      toast.success(`User ${current ? "disabled" : "enabled"}`);
      loadUsers();
    } catch {
      toast.error("Failed to update user");
    }
  };

  const deleteUser = async (uid, name) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await api.delete(`/admin/users/${uid}`);
      toast.success("User deleted");
      loadUsers();
    } catch (e) {
      toast.error(e.response?.data?.error || "Delete failed");
    }
  };

  const saveThreshold = async () => {
    try {
      await api.patch("/admin/threshold", { threshold });
      toast.success("Threshold updated");
    } catch {
      toast.error("Failed to update threshold");
    }
  };

  // ================= UI =================

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Navbar title="Admin Dashboard" onRefresh={refresh} loading={loading} />

        <main className="flex-1 p-6 space-y-6">

          {/* OVERVIEW */}
          {analytics ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Students" value={analytics.total_students} icon={Users} />
                <StatCard title="Present" value={analytics.today_present} icon={UserCheck} />
                <StatCard title="Absent" value={analytics.today_absent} icon={UserX} />
                <StatCard title="Palm Samples" value={analytics.total_palm_samples} icon={Fingerprint} />
              </div>

              {/* MODEL STATUS */}
              <div className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">
                    {analytics.model_ready ? "Model Ready" : "Model Not Trained"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {analytics.model_ready
                      ? `Trained on ${analytics.total_palm_samples} samples`
                      : "Train model to enable recognition"}
                  </p>
                </div>

                <button onClick={trainModel} disabled={training} className="btn-primary">
                  {training ? (
                    <>
                      <RefreshCw className="animate-spin" size={15} />
                      Training...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={15} />
                      Retrain Model
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <p className="text-center text-slate-400">Loading...</p>
          )}

          {/* USERS */}
          <div className="card">
            <h3 className="text-white mb-3">Users</h3>
            {users.map(u => (
              <div key={u.id} className="flex justify-between py-2 border-b border-slate-700">
                <span>{u.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => toggleUser(u.id, u.is_active)}>
                    {u.is_active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => deleteUser(u.id, u.name)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* SETTINGS */}
          <div className="card">
            <h3 className="text-white mb-3">Threshold</h3>
            <input
              type="range"
              min="0.3"
              max="0.99"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
            />
            <button onClick={saveThreshold}>Save</button>
          </div>

        </main>
      </div>
    </div>
  );
}