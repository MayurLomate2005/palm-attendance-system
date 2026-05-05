import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Hand, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form,    setForm]    = useState({ email: "", password: "" });
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      const dest = { admin: "/admin", teacher: "/teacher", student: "/student" };
      navigate(dest[user.role] || "/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (email, password) => {
    setForm({ email, password });
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      const dest = { admin: "/admin", teacher: "/teacher", student: "/student" };
      navigate(dest[user.role] || "/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10
                        rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-600/10
                        rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br
                          from-brand-500 to-violet-600 items-center justify-center
                          shadow-2xl shadow-brand-600/40 mb-4">
            <Hand size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-500 mt-1 text-sm">Sign in to PalmID Attendance System</p>
        </div>

        {/* Card */}
        <div className="card">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10
                            border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="email" type="email" required
                  value={form.email} onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="password" type={show ? "text" : "password"} required
                  value={form.password} onChange={(e) => set("password", e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500
                             hover:text-slate-300 transition-colors">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base font-semibold mt-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
              ) : "Sign In"}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-xs text-slate-500 text-center mb-3 uppercase tracking-wider">
              Quick Demo Access
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Admin",   email: "admin@palm.sys",   pw: "admin123",   color: "text-violet-400" },
                { label: "Teacher", email: "teacher@palm.sys", pw: "teacher123", color: "text-blue-400"   },
              ].map(({ label, email, pw, color }) => (
                <button key={label} type="button" onClick={() => demoLogin(email, pw)}
                  className="btn-secondary justify-center text-xs py-2">
                  <span className={color}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-slate-600 mt-6">
          New student?{" "}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
