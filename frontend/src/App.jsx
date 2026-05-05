import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login          from "./pages/Login";
import Register       from "./pages/Register";
import NotFound       from "./pages/NotFound";
import KioskPage      from "./pages/KioskPage";
import AdminDashboard   from "./dashboard/AdminDashboard";
import TeacherDashboard from "./dashboard/TeacherDashboard";
import StudentDashboard from "./dashboard/StudentDashboard";

/* Protected route wrapper */
function Protected({ children, allow }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

/* Role → dashboard map */
function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const map = { admin: "/admin", teacher: "/teacher", student: "/student" };
  return <Navigate to={map[user.role] || "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public — no login needed */}
      <Route path="/kiosk" element={<KioskPage />} />

      <Route path="/"        element={<Navigate to="/dashboard" replace />} />
      <Route path="/login"   element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Protected><DashboardRedirect /></Protected>} />

      <Route path="/admin"   element={<Protected allow={["admin"]}><AdminDashboard /></Protected>} />
      <Route path="/teacher" element={<Protected allow={["teacher","admin"]}><TeacherDashboard /></Protected>} />
      <Route path="/student" element={<Protected allow={["student"]}><StudentDashboard /></Protected>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
