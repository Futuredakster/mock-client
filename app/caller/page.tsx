"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────

type Flow = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  node_count: string;
  edge_count: string;
  created_at: string;
  updated_at: string;
};

type Batch = {
  batch_id: string;
  batch_name: string | null;
  uploaded_at: string;
  total_rows: string;
  pending: string;
  calling: string;
  completed: string;
  failed: string;
  skipped: string;
  no_answer: string;
  voicemail: string;
  with_outcome: string;
  uploaded_by_name: string;
  flow_name: string | null;
  flow_id: string | null;
  data_fields: string[];
};

type Upload = {
  id: string;
  batch_id: string;
  phone_number: string;
  raw_data: Record<string, string>;
  status: string;
  outcome: string | null;
  call_summary: string | null;
  call_duration: number | null;
  called_at: string | null;
  created_at: string;
};

// ─── Steps ────────────────────────────────────────────────────────

type Step = "select-flow" | "select-data" | "call-dashboard";

export default function CallerPage() {
  const { user, token, loading, serverUrl, authHeaders } = useAuth();
  const router = useRouter();

  // Navigation
  const [step, setStep] = useState<Step>("select-flow");
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  // Data
  const [flows, setFlows] = useState<Flow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchRows, setBatchRows] = useState<Upload[]>([]);

  // Flow variables expected by the selected flow
  const [flowVariables, setFlowVariables] = useState<string[]>([]);

  // Call state
  const [callingIds, setCallingIds] = useState<Set<string>>(new Set());
  const [callingAll, setCallingAll] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // ─── Fetch Flows ──────────────────────────────────────────────

  const fetchFlows = useCallback(async () => {
    if (!token || !user) return;
    try {
      const res = await fetch(`${serverUrl}/api/flows?userId=${user.id}`);
      const data = await res.json();
      setFlows(Array.isArray(data) ? data.filter((f: Flow) => f.is_active) : []);
    } catch {}
  }, [token, serverUrl, user]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // ─── Fetch Batches ────────────────────────────────────────────

  const fetchBatches = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${serverUrl}/api/uploads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBatches(await res.json());
    } catch {}
  }, [token, serverUrl]);

  useEffect(() => {
    if (step === "select-flow" || step === "select-data") fetchBatches();
  }, [step, fetchBatches]);

  // ─── Fetch Batch Rows ────────────────────────────────────────

  const fetchBatchRows = useCallback(async (batchId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${serverUrl}/api/uploads/batch/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBatchRows(await res.json());
    } catch {}
  }, [token, serverUrl]);

  // Auto-refresh rows while on call dashboard
  useEffect(() => {
    if (step !== "call-dashboard" || !selectedBatch) return;
    const id = setInterval(() => fetchBatchRows(selectedBatch.batch_id), 5000);
    return () => clearInterval(id);
  }, [step, selectedBatch, fetchBatchRows]);

  // ─── Actions ──────────────────────────────────────────────────

  const selectFlow = async (flow: Flow) => {
    setSelectedFlow(flow);
    setSelectedBatch(null);
    setBatchRows([]);
    setFlowVariables([]);
    setStep("select-data");

    // Fetch the variables/placeholders this flow expects
    try {
      const res = await fetch(`${serverUrl}/api/flows/${flow.id}/variables`);
      if (res.ok) {
        const data = await res.json();
        setFlowVariables(data.variables || []);
      }
    } catch {}
  };

  const selectBatch = async (batch: Batch) => {
    setSelectedBatch(batch);

    // If this batch has no flow assigned, assign the selected flow
    if (!batch.flow_id && selectedFlow) {
      setAssigning(true);
      try {
        await fetch(`${serverUrl}/api/uploads/batch/${batch.batch_id}/flow`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ flowId: selectedFlow.id }),
        });
        // Update the batch object locally
        batch.flow_id = selectedFlow.id;
        batch.flow_name = selectedFlow.name;
        fetchBatches();
      } catch {}
      setAssigning(false);
    }

    await fetchBatchRows(batch.batch_id);
    setStep("call-dashboard");
  };

  const callUpload = async (uploadId: string) => {
    setCallingIds((prev) => new Set(prev).add(uploadId));
    try {
      const res = await fetch(`${serverUrl}/call-upload/${uploadId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (selectedBatch) await fetchBatchRows(selectedBatch.batch_id);
      fetchBatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Call failed");
    } finally {
      setCallingIds((prev) => {
        const s = new Set(prev);
        s.delete(uploadId);
        return s;
      });
    }
  };

  const callAllPending = async () => {
    const pending = batchRows.filter((r) => r.status === "pending");
    if (pending.length === 0) return;
    if (!confirm(`Start calling ${pending.length} pending contacts?`)) return;

    setCallingAll(true);
    for (const row of pending) {
      await callUpload(row.id);
      await new Promise((r) => setTimeout(r, 2000));
    }
    setCallingAll(false);
  };

  const goBack = () => {
    if (step === "call-dashboard") {
      setStep("select-data");
      setBatchRows([]);
      setSelectedBatch(null);
    } else if (step === "select-data") {
      setStep("select-flow");
      setSelectedFlow(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-yellow-900/40 text-yellow-300 border-yellow-700";
      case "calling": return "bg-blue-900/40 text-blue-300 border-blue-700";
      case "completed": return "bg-green-900/40 text-green-300 border-green-700";
      case "failed": return "bg-red-900/40 text-red-300 border-red-700";
      case "no_answer": return "bg-orange-900/40 text-orange-300 border-orange-700";
      case "voicemail": return "bg-purple-900/40 text-purple-300 border-purple-700";
      default: return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  // ─── Field matching helpers ────────────────────────────────

  const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, "");

  const getFieldMatch = (batchFields: string[]) => {
    if (flowVariables.length === 0) return { matched: [] as string[], missing: [] as string[], extra: [] as string[] };
    const normalizedBatch = batchFields.map((f) => ({ original: f, norm: normalize(f) }));
    const matched: string[] = [];
    const missing: string[] = [];
    for (const v of flowVariables) {
      const normV = normalize(v);
      const found = normalizedBatch.find((bf) => bf.norm === normV);
      if (found) {
        matched.push(v);
      } else {
        missing.push(v);
      }
    }
    const matchedNorms = new Set(matched.map(normalize));
    const extra = batchFields.filter((f) => !matchedNorms.has(normalize(f)));
    return { matched, missing, extra };
  };

  const batchesForFlow = selectedFlow
    ? {
        assigned: batches.filter((b) => b.flow_id === selectedFlow.id),
        unassigned: batches.filter((b) => !b.flow_id && Number(b.pending) > 0),
      }
    : { assigned: [], unassigned: [] };

  const pendingCount = batchRows.filter((r) => r.status === "pending").length;
  const callingCount = batchRows.filter((r) => r.status === "calling").length;
  const completedCount = batchRows.filter((r) => r.status === "completed").length;

  // ─── Render ───────────────────────────────────────────────────

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => { setStep("select-flow"); setSelectedFlow(null); setSelectedBatch(null); }}
            className={`transition-colors cursor-pointer ${step === "select-flow" ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            📞 Caller
          </button>
          {selectedFlow && (
            <>
              <span className="text-zinc-600">/</span>
              <button
                onClick={() => { setStep("select-data"); setSelectedBatch(null); }}
                className={`transition-colors cursor-pointer ${step === "select-data" ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {selectedFlow.name}
              </button>
            </>
          )}
          {selectedBatch && step === "call-dashboard" && (
            <>
              <span className="text-zinc-600">/</span>
              <span className="text-white font-medium">
                Batch {new Date(selectedBatch.uploaded_at).toLocaleDateString()}
              </span>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            STEP 1: SELECT A FLOW
        ═══════════════════════════════════════════════════════ */}
        {step === "select-flow" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">📞 Start Calling</h1>
              <p className="text-zinc-400 text-sm mt-1">
                Select a conversation flow to use for your calls
              </p>
            </div>

            {flows.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                <div className="text-4xl mb-4">🔀</div>
                <h3 className="text-lg font-semibold mb-2">No active flows</h3>
                <p className="text-zinc-500 text-sm mb-4">
                  You need at least one active conversation flow to start calling.
                </p>
                <Link
                  href="/flows"
                  className="inline-block px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Go to Flows →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {flows.map((flow) => {
                  const flowBatches = batches.filter((b) => b.flow_id === flow.id);
                  const totalPending = flowBatches.reduce((sum, b) => sum + Number(b.pending), 0);
                  const totalCompleted = flowBatches.reduce((sum, b) => sum + Number(b.completed), 0);

                  return (
                    <button
                      key={flow.id}
                      onClick={() => selectFlow(flow)}
                      className="text-left bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-indigo-600/50 hover:bg-zinc-900/80 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg group-hover:text-indigo-400 transition-colors">
                            {flow.name}
                          </h3>
                          <p className="text-sm text-zinc-500 mt-1 line-clamp-2">
                            {flow.description || "No description"}
                          </p>
                        </div>
                        <span className="text-zinc-600 group-hover:text-indigo-400 text-xl ml-3 transition-colors">→</span>
                      </div>
                      <div className="mt-4 flex items-center gap-3 text-xs">
                        <span className="text-zinc-500">{flow.node_count} nodes</span>
                        {totalPending > 0 && (
                          <span className="text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full">
                            ⏳ {totalPending} pending
                          </span>
                        )}
                        {totalCompleted > 0 && (
                          <span className="text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
                            ✅ {totalCompleted} done
                          </span>
                        )}
                        {flowBatches.length === 0 && (
                          <span className="text-zinc-600">No data yet</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STEP 2: SELECT DATA (batch)
        ═══════════════════════════════════════════════════════ */}
        {step === "select-data" && selectedFlow && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">📋 Select Call Data</h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Choose an upload batch to call with{" "}
                  <span className="text-indigo-400 font-medium">{selectedFlow.name}</span>
                </p>
              </div>
              <button onClick={goBack} className="text-sm text-zinc-500 hover:text-white transition-colors cursor-pointer">
                ← Back
              </button>
            </div>

            {/* Batches already assigned to this flow */}
            {/* Flow expects these variables */}
            {flowVariables.length > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-4 py-3">
                <p className="text-xs font-medium text-zinc-400 mb-1.5">Flow expects these data fields:</p>
                <div className="flex flex-wrap gap-1.5">
                  {flowVariables.map((v) => (
                    <span key={v} className="text-xs px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-800/50">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {batchesForFlow.assigned.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  Assigned to this flow
                </h2>
                {batchesForFlow.assigned.map((b) => (
                  <BatchCard key={b.batch_id} batch={b} onSelect={selectBatch} assigned fieldMatch={getFieldMatch(b.data_fields || [])} />
                ))}
              </div>
            )}

            {/* Unassigned batches */}
            {batchesForFlow.unassigned.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  Unassigned uploads ({batchesForFlow.unassigned.length})
                </h2>
                <p className="text-xs text-zinc-600">
                  Selecting a batch will assign it to{" "}
                  <span className="text-indigo-400">{selectedFlow.name}</span>
                </p>
                {batchesForFlow.unassigned.map((b) => (
                  <BatchCard key={b.batch_id} batch={b} onSelect={selectBatch} assigned={false} fieldMatch={getFieldMatch(b.data_fields || [])} />
                ))}
              </div>
            )}

            {batchesForFlow.assigned.length === 0 && batchesForFlow.unassigned.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-lg font-semibold mb-2">No upload data available</h3>
                <p className="text-zinc-500 text-sm mb-4">
                  Upload an Excel file first, then come back here to start calling.
                </p>
                <Link
                  href="/uploads"
                  className="inline-block px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Go to Uploads →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STEP 3: CALL DASHBOARD
        ═══════════════════════════════════════════════════════ */}
        {step === "call-dashboard" && selectedFlow && selectedBatch && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">🎯 Call Dashboard</h1>
                <p className="text-zinc-400 text-sm mt-1">
                  {selectedFlow.name} · {batchRows.length} contacts
                </p>
              </div>
              <button onClick={goBack} className="text-sm text-zinc-500 hover:text-white transition-colors cursor-pointer">
                ← Back
              </button>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard label="Pending" value={pendingCount} color="yellow" icon="⏳" />
              <StatCard label="Calling" value={callingCount} color="blue" icon="📞" />
              <StatCard label="Completed" value={completedCount} color="green" icon="✅" />
              <StatCard label="Total" value={batchRows.length} color="zinc" icon="📊" />
            </div>

            {/* Call All button */}
            {pendingCount > 0 && (
              <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div>
                  <p className="font-medium">Ready to call {pendingCount} contacts</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Calls will be made sequentially with a 2-second delay between each
                  </p>
                </div>
                <button
                  onClick={callAllPending}
                  disabled={callingAll}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                >
                  {callingAll ? (
                    <>
                      <span className="animate-pulse">📞</span> Calling...
                    </>
                  ) : (
                    <>📞 Call All Pending</>
                  )}
                </button>
              </div>
            )}

            {assigning && (
              <div className="p-3 bg-indigo-900/30 border border-indigo-700 rounded-lg text-indigo-300 text-sm animate-pulse">
                Assigning flow to batch...
              </div>
            )}

            {/* Contacts table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Contact</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Outcome</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Summary</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium w-28">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((row) => {
                    const name =
                      row.raw_data.name ||
                      row.raw_data.patient_name ||
                      row.raw_data.Name ||
                      row.raw_data.first_name ||
                      "—";
                    return (
                      <tr key={row.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-200 text-sm">{name}</div>
                          <div className="text-xs text-zinc-600 mt-0.5">
                            {Object.entries(row.raw_data)
                              .filter(([k]) => !["name", "patient_name", "Name", "first_name"].includes(k))
                              .slice(0, 2)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-indigo-300 font-mono text-xs">{row.phone_number}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(row.status)}`}>
                            {row.status}
                          </span>
                          {row.status === "calling" && (
                            <span className="ml-1.5 text-blue-400 animate-pulse text-xs">●</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.outcome ? (
                            <span
                              className={`text-xs px-2 py-0.5 rounded border ${
                                row.outcome.includes("change")
                                  ? "bg-green-900/40 text-green-300 border-green-800/50"
                                  : row.outcome.includes("no_")
                                  ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                  : row.outcome.includes("fail")
                                  ? "bg-red-900/40 text-red-300 border-red-800/50"
                                  : "bg-zinc-800 text-zinc-300 border-zinc-700"
                              }`}
                            >
                              {row.outcome}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-xs">
                          {row.call_summary ? (
                            <span className="text-zinc-300">{row.call_summary}</span>
                          ) : row.call_duration ? (
                            <span className="text-zinc-500">{row.call_duration}s</span>
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.status === "pending" ? (
                            <button
                              onClick={() => callUpload(row.id)}
                              disabled={callingIds.has(row.id) || callingAll}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                            >
                              {callingIds.has(row.id) ? "📞 ..." : "📞 Call"}
                            </button>
                          ) : row.status === "calling" ? (
                            <span className="text-xs text-blue-400 animate-pulse">In progress</span>
                          ) : row.status === "completed" ? (
                            <span className="text-xs text-green-500">Done</span>
                          ) : (
                            <span className="text-xs text-zinc-600">{row.status}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {batchRows.length === 0 && (
                <div className="p-8 text-center text-zinc-500 text-sm">No contacts in this batch</div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

type FieldMatch = {
  matched: string[];
  missing: string[];
  extra: string[];
};

function BatchCard({
  batch,
  onSelect,
  assigned,
  fieldMatch,
}: {
  batch: Batch;
  onSelect: (b: Batch) => void;
  assigned: boolean;
  fieldMatch?: FieldMatch;
}) {
  const total = Number(batch.total_rows);
  const pending = Number(batch.pending);
  const completed = Number(batch.completed);
  const progress = total > 0 ? Math.round(((total - pending) / total) * 100) : 0;
  const hasMissing = fieldMatch && fieldMatch.missing.length > 0;

  return (
    <div className={`w-full text-left bg-zinc-900 border rounded-xl p-4 transition-all group ${
      hasMissing ? "border-amber-700/60" : "border-zinc-800 hover:border-indigo-600/50"
    }`}>
      <button
        onClick={() => onSelect(batch)}
        className="w-full text-left cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="font-medium text-zinc-200 group-hover:text-indigo-400 transition-colors">
                {batch.batch_name || `${batch.total_rows} contacts`}
              </span>
              {batch.batch_name && <span className="text-xs text-zinc-500">{batch.total_rows} contacts</span>}
              {assigned ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-400 border border-indigo-800/50">
                  ✓ Assigned
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
                  Unassigned
                </span>
              )}
              <span className="text-xs text-zinc-600">
                {new Date(batch.uploaded_at).toLocaleDateString()}{" "}
                {new Date(batch.uploaded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              {pending > 0 && <span className="text-yellow-400">⏳ {pending} pending</span>}
              {Number(batch.calling) > 0 && <span className="text-blue-400">📞 {batch.calling} calling</span>}
              {completed > 0 && <span className="text-green-400">✅ {completed} completed</span>}
              {Number(batch.failed) > 0 && <span className="text-red-400">❌ {batch.failed} failed</span>}
              {Number(batch.no_answer) > 0 && <span className="text-orange-400">☎️ {batch.no_answer} no answer</span>}
            </div>
            {/* Progress bar */}
            {assigned && progress > 0 && (
              <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 to-green-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
          <span className="text-zinc-600 group-hover:text-indigo-400 text-xl ml-4 transition-colors">→</span>
        </div>
      </button>

      {/* Field matching indicator */}
      {fieldMatch && (fieldMatch.matched.length > 0 || fieldMatch.missing.length > 0) && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60">
          <div className="flex flex-wrap gap-1.5">
            {fieldMatch.matched.map((f) => (
              <span key={f} className="text-[11px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800/40">
                ✓ {f}
              </span>
            ))}
            {fieldMatch.missing.map((f) => (
              <span key={f} className="text-[11px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/40">
                ✗ {f}
              </span>
            ))}
          </div>
          {hasMissing && (
            <p className="text-[11px] text-amber-400/80 mt-1.5">
              ⚠ Missing {fieldMatch.missing.length} field{fieldMatch.missing.length > 1 ? "s" : ""} — the AI won&apos;t be able to fill in: {fieldMatch.missing.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const colorMap: Record<string, string> = {
    yellow: "bg-yellow-900/20 border-yellow-800/50 text-yellow-300",
    blue: "bg-blue-900/20 border-blue-800/50 text-blue-300",
    green: "bg-green-900/20 border-green-800/50 text-green-300",
    zinc: "bg-zinc-900 border-zinc-800 text-zinc-300",
  };

  return (
    <div className={`rounded-xl border p-4 text-center ${colorMap[color] || colorMap.zinc}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-70">
        {icon} {label}
      </div>
    </div>
  );
}
