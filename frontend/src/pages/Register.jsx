import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Hand, Mail, Lock, User, IdCard, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirm: "", role: "student", student_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");
    if (form.password.length < 6)
      return setError("Password must be at least 6 characters.");
    setError(""); setLoading(true);
    try {
      const user = await register({
        name: form.name, email: form.email,
        password: form.password, role: form.role,
        student_id: form.student_id || undefined,
      });
      toast.success("Account created! Welcome to PalmID.");
      const dest = { admin: "/admin", teacher: "/teacher", student: "/student" };
      navigate(dest[user.role] || "/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-brand-600/10
                        rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br
                          from-brand-500 to-violet-600 items-center justify-center
                          shadow-2xl shadow-brand-600/40 mb-4">
            <Hand size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="text-slate-500 mt-1 text-sm">Join PalmID Attendance System</p>
        </div>

        <div className="card">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10
                            border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input required value={form.name} onChange={(e) => set("name", e.target.value)}
                  placeholder="John Doe" className="input pl-10" />
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" required value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com" className="input pl-10" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Role</label>
                <select value={form.role} onChange={(e) => set("role", e.target.value)}
                  className="input">
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div>
                <label className="label">ID (optional)</label>
                <div className="relative">
                  <IdCard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={form.student_id} onChange={(e) => set("student_id", e.target.value)}
                    placeholder="STU001" className="input pl-10" />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="password" required value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Min 6 chars" className="input pl-10" />
              </div>
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="password" required value={form.confirm}
                  onChange={(e) => set("confirm", e.target.value)}
                  placeholder="Repeat password" className="input pl-10" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base font-semibold mt-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
              ) : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
