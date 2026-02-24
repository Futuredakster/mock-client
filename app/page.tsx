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
  const [stats, setStats] = useState({ totalFlows: 0, totalUploads: 0, pendingCalls: 0, completedCalls: 0 });

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
        setStats((s) => ({ ...s, totalUploads, pendingCalls, completedCalls }));
      })
      .catch(() => {});
  }, [token, user, serverUrl, authHeaders]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const completionRate = stats.totalUploads > 0
    ? Math.round((stats.completedCalls / stats.totalUploads) * 100)
    : 0;

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading dashboard…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-8">

        {/* ── Hero / Greeting ──────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600/20 via-zinc-900 to-zinc-900 border border-indigo-500/10 p-8">
          {/* Glow blob */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-violet-500/8 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-indigo-400 text-sm font-medium tracking-wide uppercase mb-1">{greeting}</p>
              <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
              <p className="text-zinc-400 text-sm mt-2 max-w-md">
                Here&apos;s a snapshot of your AI calling operations. You have{" "}
                {stats.pendingCalls > 0 ? (
                  <span className="text-yellow-400 font-medium">{stats.pendingCalls} pending call{stats.pendingCalls !== 1 ? "s" : ""}</span>
                ) : (
                  <span className="text-green-400 font-medium">no pending calls</span>
                )}{" "}
                right now.
              </p>
            </div>
            <Link
              href="/caller"
              className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/20 cursor-pointer"
            >
              <span>📞</span> Go to Call Center
            </Link>
          </div>
        </div>

        {/* ── Stats Grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FlowIcon />}
            label="Flows"
            value={stats.totalFlows}
            sub={`${flows.filter(f => f.is_active).length} active`}
            gradient="from-indigo-500/15 to-indigo-500/5"
            accent="text-indigo-400"
            ring="ring-indigo-500/20"
          />
          <StatCard
            icon={<ContactIcon />}
            label="Contacts"
            value={stats.totalUploads}
            sub={`${batches.length} batch${batches.length !== 1 ? "es" : ""}`}
            gradient="from-blue-500/15 to-blue-500/5"
            accent="text-blue-400"
            ring="ring-blue-500/20"
          />
          <StatCard
            icon={<PendingIcon />}
            label="Pending"
            value={stats.pendingCalls}
            sub="awaiting call"
            gradient="from-amber-500/15 to-amber-500/5"
            accent="text-amber-400"
            ring="ring-amber-500/20"
          />
          <StatCard
            icon={<CheckIcon />}
            label="Completed"
            value={stats.completedCalls}
            sub={`${completionRate}% completion`}
            gradient="from-emerald-500/15 to-emerald-500/5"
            accent="text-emerald-400"
            ring="ring-emerald-500/20"
          />
        </div>

        {/* ── Completion Progress Bar ──────────────────────────── */}
        {stats.totalUploads > 0 && (
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/80 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-zinc-300">Overall Completion</span>
              <span className="text-sm font-bold text-zinc-200">{completionRate}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-1000 ease-out"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
              <span>{stats.completedCalls} completed</span>
              <span>{stats.pendingCalls} remaining</span>
            </div>
          </div>
        )}

        {/* ── Two Column Cards ─────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Recent Flows */}
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/80 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-semibold tracking-tight">Recent Flows</h2>
              <Link href="/flows" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                View all →
              </Link>
            </div>
            {flows.length === 0 ? (
              <div className="text-center py-12 px-5">
                <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center mb-3">
                  <FlowIcon />
                </div>
                <p className="text-zinc-400 text-sm mb-4">No flows created yet</p>
                <Link
                  href="/flows"
                  className="inline-block px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Create Your First Flow
                </Link>
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1">
                {flows.map((f) => (
                  <Link
                    key={f.id}
                    href={`/flows/${f.id}`}
                    className="flex items-center justify-between px-3 py-3 hover:bg-white/[0.03] rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${f.is_active ? "bg-emerald-400" : "bg-zinc-600"}`} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-zinc-200 group-hover:text-white transition-colors truncate">
                          {f.name}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">{f.description || "No description"}</div>
                      </div>
                    </div>
                    <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors text-sm ml-2">→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Contacts */}
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/80 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-semibold tracking-tight">Recent Batches</h2>
              <Link href="/uploads" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                View all →
              </Link>
            </div>
            {batches.length === 0 ? (
              <div className="text-center py-12 px-5">
                <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                  <ContactIcon />
                </div>
                <p className="text-zinc-400 text-sm mb-4">No contacts uploaded yet</p>
                <Link
                  href="/uploads"
                  className="inline-block px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Upload Your First Excel
                </Link>
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1">
                {batches.map((b) => {
                  const total = Number(b.total_rows);
                  const done = Number(b.completed);
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <div key={b.batch_id} className="px-3 py-3 hover:bg-white/[0.03] rounded-xl transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-zinc-200 truncate">{b.flow_name || "Unassigned"}</span>
                        <span className="text-[11px] text-zinc-600 ml-2 flex-shrink-0">
                          {new Date(b.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-zinc-500 w-16 text-right">{done}/{total}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                        {Number(b.pending) > 0 && <span className="text-amber-400/80">⏳ {b.pending}</span>}
                        {Number(b.calling) > 0 && <span className="text-blue-400/80">📞 {b.calling}</span>}
                        {done > 0 && <span className="text-emerald-400/80">✅ {done}</span>}
                        {Number(b.failed) > 0 && <span className="text-red-400/80">✗ {b.failed}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickAction
            href="/flows"
            icon={<FlowIcon />}
            title="Manage Flows"
            sub="Create & edit call scripts"
            gradient="from-indigo-500/10 to-transparent"
            hoverBorder="hover:border-indigo-500/30"
          />
          <QuickAction
            href="/uploads"
            icon={<ContactIcon />}
            title="Contacts"
            sub="Import & manage contacts"
            gradient="from-blue-500/10 to-transparent"
            hoverBorder="hover:border-blue-500/30"
          />
          <QuickAction
            href="/caller"
            icon={<PhoneIcon />}
            title="Call Center"
            sub="Start & schedule calls"
            gradient="from-emerald-500/10 to-transparent"
            hoverBorder="hover:border-emerald-500/30"
          />
        </div>
      </div>
    </main>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  sub,
  gradient,
  accent,
  ring,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  gradient: string;
  accent: string;
  ring: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} border border-zinc-800/80 p-5 ring-1 ${ring}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-zinc-800/80 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-bold tracking-tight ${accent}`}>{value}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
      <div className="text-[11px] text-zinc-600 mt-1">{sub}</div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  sub,
  gradient,
  hoverBorder,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  gradient: string;
  hoverBorder: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-br ${gradient} p-5 transition-all ${hoverBorder} hover:shadow-lg hover:shadow-black/20`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">{title}</div>
          <div className="text-xs text-zinc-500">{sub}</div>
        </div>
      </div>
    </Link>
  );
}

/* ── SVG Icons ────────────────────────────────────────────────── */

function FlowIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  );
}
