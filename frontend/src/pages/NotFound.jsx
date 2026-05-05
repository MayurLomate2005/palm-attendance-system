import { Link } from "react-router-dom";
import { Hand, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
      <Hand size={52} className="text-brand-500 mb-4 opacity-60" />
      <h1 className="text-7xl font-black text-gradient mb-2">404</h1>
      <p className="text-xl text-slate-400 font-medium mb-1">Page Not Found</p>
      <p className="text-sm text-slate-600 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard" className="btn-primary">
        <Home size={16} /> Back to Dashboard
      </Link>
    </div>
  );
}
