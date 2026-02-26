"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

type Flow = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
};

type Batch = {
  batch_id: string;
  uploaded_at: string;
  total_rows: string;
  pending: string;
  calling: string;
  completed: string;
  failed: string;
  flow_name: string | null;
};

export default function DashboardPage() {
  const { user, token, loading, serverUrl, authHeaders } = useAuth();
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState({ totalFlows: 0, totalUploads: 0, pendingCalls: 0, completedCalls: 0, callingNow: 0, failedCalls: 0 });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!token || !user) return;

    fetch(`${serverUrl}/api/flows?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        setFlows(Array.isArray(data) ? data.slice(0, 5) : []);
        setStats((s) => ({ ...s, totalFlows: Array.isArray(data) ? data.length : 0 }));
      })
      .catch(() => {});

    fetch(`${serverUrl}/api/uploads`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setBatches(arr.slice(0, 5));
        const totalUploads = arr.reduce((sum: number, b: Batch) => sum + Number(b.total_rows), 0);
        const pendingCalls = arr.reduce((sum: number, b: Batch) => sum + Number(b.pending), 0);
        const completedCalls = arr.reduce((sum: number, b: Batch) => sum + Number(b.completed), 0);
        const callingNow = arr.reduce((sum: number, b: Batch) => sum + Number(b.calling), 0);
        const failedCalls = arr.reduce((sum: number, b: Batch) => sum + Number(b.failed), 0);
        setStats((s) => ({ ...s, totalUploads, pendingCalls, completedCalls, callingNow, failedCalls }));
      })
      .catch(() => {});
  }, [token, user, serverUrl, authHeaders]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const answerRate = stats.totalUploads > 0
    ? Math.round((stats.completedCalls / stats.totalUploads) * 100)
    : 0;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {greeting}, {user.name?.split(" ")[0]}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Here&apos;s what&apos;s happening with your calls today.
          </p>
        </div>
        <Link
          href="/caller"
          className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
          style={{ background: "var(--accent)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Campaign
        </Link>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Contacts"
          value={stats.totalUploads}
          change={stats.pendingCalls > 0 ? `${stats.pendingCalls} pending` : "All processed"}
          changeType={stats.pendingCalls > 0 ? "warning" : "success"}
          icon={<ContactsStatIcon />}
        />
        <StatCard
          label="Answer Rate"
          value={`${answerRate}%`}
          change={`${stats.completedCalls} answered`}
          changeType="success"
          icon={<PhoneStatIcon />}
        />
        <StatCard
          label="Active Flows"
          value={stats.totalFlows}
          change={`${flows.filter(f => f.is_active).length} active`}
          changeType="info"
          icon={<FlowStatIcon />}
        />
        <StatCard
          label="Completed"
          value={stats.completedCalls}
          change={stats.failedCalls > 0 ? `${stats.failedCalls} failed` : "No failures"}
          changeType={stats.failedCalls > 0 ? "danger" : "success"}
          icon={<CheckStatIcon />}
        />
      </div>

      {/* ── Two Column: Chart placeholder + Call Outcomes ───── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Call Volume Chart Placeholder */}
        <div className="rounded-xl border p-5" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Call Volume</h2>
            <span className="text-xs px-2.5 py-1 rounded-md" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
              Last 7 days
            </span>
          </div>
          <div className="h-40 flex items-end gap-2 px-2">
            {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md transition-all hover:opacity-80"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(to top, var(--accent), rgba(124, 92, 252, 0.4))`,
                  }}
                />
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Call Outcomes */}
        <div className="rounded-xl border p-5" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Call Outcomes</h2>
          <div className="space-y-4">
            <OutcomeBar label="Completed" value={stats.completedCalls} max={stats.totalUploads || 1} color="var(--success)" />
            <OutcomeBar label="Pending" value={stats.pendingCalls} max={stats.totalUploads || 1} color="var(--warning)" />
            <OutcomeBar label="In Progress" value={stats.callingNow} max={stats.totalUploads || 1} color="var(--info)" />
            <OutcomeBar label="Failed" value={stats.failedCalls} max={stats.totalUploads || 1} color="var(--danger)" />
          </div>
        </div>
      </div>

      {/* ── Recent Batches Table ────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Contacts</h2>
          <Link
            href="/uploads"
            className="text-xs font-medium transition-colors"
            style={{ color: "var(--accent)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent)")}
          >
            View all →
          </Link>
        </div>

        {batches.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3" style={{ background: "var(--accent-muted)" }}>
              <svg className="w-5 h-5" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
              </svg>
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>No contacts yet</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>Create your first contact list by uploading data</p>
            <Link
              href="/uploads"
              className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "var(--accent)" }}
            >
              New Contact List
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Contact List</th>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-tertiary)" }}>Contacts</th>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Progress</th>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-tertiary)" }}>Status</th>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-tertiary)" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const total = Number(b.total_rows);
                const done = Number(b.completed);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const pending = Number(b.pending);
                const calling = Number(b.calling);
                const status = calling > 0 ? "In Progress" : pending > 0 ? "Pending" : done === total ? "Completed" : "Mixed";
                const statusStyle = calling > 0
                  ? { bg: "rgba(96,165,250,0.12)", color: "var(--info)", dot: "var(--info)" }
                  : pending > 0 && done === 0
                  ? { bg: "rgba(251,191,36,0.12)", color: "var(--warning)", dot: "var(--warning)" }
                  : done === total
                  ? { bg: "rgba(52,211,153,0.12)", color: "var(--success)", dot: "var(--success)" }
                  : { bg: "rgba(124,92,252,0.12)", color: "var(--accent)", dot: "var(--accent)" };

                return (
                  <tr
                    key={b.batch_id}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border-secondary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => router.push("/caller")}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {b.flow_name || "Unassigned"}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell" style={{ color: "var(--text-secondary)" }}>
                      {total}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full max-w-[100px]" style={{ background: "var(--bg-hover)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: "var(--accent)" }}
                          />
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(b.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */

function StatCard({
  label,
  value,
  change,
  changeType,
  icon,
}: {
  label: string;
  value: number | string;
  change: string;
  changeType: "success" | "warning" | "danger" | "info";
  icon: React.ReactNode;
}) {
  const changeColorMap = {
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    info: "var(--info)",
  };

  return (
    <div
      className="rounded-xl border p-5 transition-colors"
      style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-hover)" }}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{value}</div>
      <p className="text-xs mt-1 font-medium" style={{ color: changeColorMap[changeType] }}>{change}</p>
    </div>
  );
}

function OutcomeBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "var(--bg-hover)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/* ── SVG Icons ────────────────────────────────────────────────── */

function ContactsStatIcon() {
  return (
    <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function PhoneStatIcon() {
  return (
    <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  );
}

function FlowStatIcon() {
  return (
    <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function CheckStatIcon() {
  return (
    <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
