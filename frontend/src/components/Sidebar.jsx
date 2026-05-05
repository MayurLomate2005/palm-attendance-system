import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, ClipboardList, Activity,
  Settings, LogOut, Hand, Shield, GraduationCap, BookOpen, Calendar,
} from "lucide-react";
import clsx from "clsx";

const roleNav = {
  admin: [
    { to: "/admin",            icon: LayoutDashboard, label: "Dashboard"  },
    { to: "/admin#users",      icon: Users,           label: "Users"      },
    { to: "/admin#logs",       icon: Activity,        label: "Audit Logs" },
    { to: "/admin#cfg",        icon: Settings,        label: "Settings"   },
  ],
  teacher: [
    { to: "/teacher",          icon: LayoutDashboard, label: "Dashboard"  },
    { to: "/teacher#session",  icon: ClipboardList,   label: "Session"    },
    { to: "/teacher#class",    icon: BookOpen,        label: "Class View" },
  ],
  student: [
    { to: "/student",          icon: LayoutDashboard, label: "Dashboard"     },
    { to: "/student#register", icon: Hand,            label: "Register Palm" },
    { to: "/student#attendance",icon: Calendar,       label: "My Attendance" },
  ],
};

const roleIcon  = { admin: Shield, teacher: GraduationCap, student: Hand };
const roleColor = {
  admin:   "text-violet-400",
  teacher: "text-blue-400",
  student: "text-emerald-400",
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = roleNav[user?.role] || [];
  const RoleIcon = roleIcon[user?.role] || Shield;

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-surface-100 border-r border-white/5
                      flex flex-col z-30 shadow-2xl">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600
                          flex items-center justify-center shadow-lg shadow-brand-600/30">
            <Hand size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">PalmID</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
              Biometric Attendance
            </p>
          </div>
        </div>
      </div>

      {/* User card */}
      <div className="mx-3 mt-4 p-3 rounded-xl bg-white/3 border border-white/5">
        <div className="flex items-center gap-3">
          <div className={clsx(
            "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold",
            "bg-surface-200",
            roleColor[user?.role]
          )}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <div className="flex items-center gap-1">
              <RoleIcon size={10} className={clsx("shrink-0", roleColor[user?.role])} />
              <p className={clsx("text-[11px] capitalize font-medium", roleColor[user?.role])}>
                {user?.role}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-semibold">
          Navigation
        </p>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx("nav-item", isActive && "active")
            }
          >
            <Icon size={16} className="shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5 border-t border-white/5 pt-3">
        <button onClick={handleLogout}
          className="nav-item w-full text-red-400 hover:bg-red-500/10 hover:text-red-300">
          <LogOut size={16} className="shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
