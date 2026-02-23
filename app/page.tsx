"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

    // Fetch flows
    fetch(`${serverUrl}/api/flows?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        setFlows(Array.isArray(data) ? data.slice(0, 5) : []);
        setStats((s) => ({ ...s, totalFlows: Array.isArray(data) ? data.length : 0 }));
      })
      .catch(() => {});

    // Fetch batches
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

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user.name} 👋</h1>
          <p className="text-zinc-400 text-sm mt-1">Here&apos;s an overview of your call operations</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Flows", value: stats.totalFlows, icon: "🔀", color: "text-indigo-400" },
            { label: "Uploaded Contacts", value: stats.totalUploads, icon: "📋", color: "text-blue-400" },
            { label: "Pending Calls", value: stats.pendingCalls, icon: "⏳", color: "text-yellow-400" },
            { label: "Completed Calls", value: stats.completedCalls, icon: "✅", color: "text-green-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Flows */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Flows</h2>
              <Link href="/flows" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
            </div>
            {flows.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-500 text-sm mb-3">No flows yet</p>
                <Link
                  href="/flows"
                  className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Create Your First Flow
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {flows.map((f) => (
                  <Link
                    key={f.id}
                    href={`/flows/${f.id}`}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm">{f.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{f.description || "No description"}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${f.is_active ? "bg-green-900/40 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                      {f.is_active ? "Active" : "Inactive"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Contacts */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Contacts</h2>
              <Link href="/uploads" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
            </div>
            {batches.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-500 text-sm mb-3">No contacts yet</p>
                <Link
                  href="/uploads"
                  className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Upload Your First Excel
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map((b) => (
                  <div key={b.batch_id} className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{b.flow_name || "No flow"}</span>
                      <span className="text-xs text-zinc-500">
                        {new Date(b.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="text-zinc-400">{b.total_rows} contacts</span>
                      {Number(b.pending) > 0 && <span className="text-yellow-400">⏳{b.pending}</span>}
                      {Number(b.completed) > 0 && <span className="text-green-400">✅{b.completed}</span>}
                      {Number(b.failed) > 0 && <span className="text-red-400">❌{b.failed}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <Link
            href="/flows"
            className="p-4 bg-zinc-900 border border-zinc-800 hover:border-indigo-600/50 rounded-xl text-center transition-colors"
          >
            <div className="text-2xl mb-2">🔀</div>
            <div className="text-sm font-medium">Manage Flows</div>
            <div className="text-xs text-zinc-500 mt-1">Create call scripts</div>
          </Link>
          <Link
            href="/uploads"
            className="p-4 bg-zinc-900 border border-zinc-800 hover:border-indigo-600/50 rounded-xl text-center transition-colors"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="text-sm font-medium">Contacts</div>
            <div className="text-xs text-zinc-500 mt-1">Import & manage contacts</div>
          </Link>
          <Link
            href="/caller"
            className="p-4 bg-zinc-900 border border-zinc-800 hover:border-indigo-600/50 rounded-xl text-center transition-colors"
          >
            <div className="text-2xl mb-2">📞</div>
            <div className="text-sm font-medium">Call Center</div>
            <div className="text-xs text-zinc-500 mt-1">Start & monitor calls</div>
          </Link>
        </div>
      </div>
    </main>
  );
}
