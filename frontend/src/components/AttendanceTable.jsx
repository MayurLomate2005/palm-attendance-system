import clsx from "clsx";
import { CheckCircle2, XCircle, Clock, Fingerprint } from "lucide-react";

const methodBadge = {
  palm:   <span className="badge badge-blue"><Fingerprint size={10}/>Palm</span>,
  manual: <span className="badge badge-yellow">Manual</span>,
};
const statusBadge = {
  present: <span className="badge badge-green"><CheckCircle2 size={10}/>Present</span>,
  absent:  <span className="badge badge-red"><XCircle size={10}/>Absent</span>,
  late:    <span className="badge badge-yellow"><Clock size={10}/>Late</span>,
};

export default function AttendanceTable({ records = [], showUser = true, loading = false }) {
  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!records.length) return (
    <div className="text-center py-12 text-slate-500">
      <Fingerprint size={36} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">No attendance records found</p>
    </div>
  );

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {showUser && <th>Student</th>}
            <th>Date</th>
            <th>Time</th>
            <th>Status</th>
            <th>Method</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="animate-fade-in">
              {showUser && (
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-surface-200 flex items-center justify-center
                                    text-xs font-bold text-brand-400">
                      {r.user_name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-200">{r.user_name}</span>
                  </div>
                </td>
              )}
              <td className="font-mono text-sm">{r.date}</td>
              <td className="font-mono text-sm">{r.time}</td>
              <td>{statusBadge[r.status] ?? r.status}</td>
              <td>{methodBadge[r.method] ?? r.method}</td>
              <td>
                {r.confidence != null ? (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className={clsx("h-full rounded-full",
                          r.confidence >= 0.85 ? "bg-emerald-400" :
                          r.confidence >= 0.70 ? "bg-yellow-400" : "bg-red-400")}
                        style={{ width: `${(r.confidence * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {(r.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ) : <span className="text-slate-600 text-xs">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
