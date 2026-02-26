"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  scheduled: string;
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
  scheduled_at: string | null;
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
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [batchStats, setBatchStats] = useState<{
    total: number; pending: number; calling: number;
    completed: number; scheduled: number; failed: number;
    nextScheduledAt: string | null;
  }>({ total: 0, pending: 0, calling: 0, completed: 0, scheduled: 0, failed: 0, nextScheduledAt: null });

  // Flow variables expected by the selected flow
  const [flowVariables, setFlowVariables] = useState<string[]>([]);

  // Call state
  const [callingIds, setCallingIds] = useState<Set<string>>(new Set());
  const [callingAll, setCallingAll] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // Search & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [batchSearch, setBatchSearch] = useState("");
  const pageSize = 15;
  const searchRef = useRef(debouncedSearch);
  const pageRef = useRef(currentPage);
  searchRef.current = debouncedSearch;
  pageRef.current = currentPage;

  // Debounce search input → triggers server fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const fetchBatchRows = useCallback(async (batchId: string, search?: string, page?: number) => {
    if (!token) return;
    const s = search ?? searchRef.current;
    const p = page ?? pageRef.current;
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (s) params.set("search", s);
      const res = await fetch(`${serverUrl}/api/uploads/batch/${batchId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBatchRows(data.rows);
        setFilteredTotal(data.filteredTotal);
        setBatchStats(data.stats);
      }
    } catch {}
  }, [token, serverUrl]);

  // Re-fetch when search or page changes
  useEffect(() => {
    if (step !== "call-dashboard" || !selectedBatch) return;
    fetchBatchRows(selectedBatch.batch_id, debouncedSearch, currentPage);
  }, [debouncedSearch, currentPage, step, selectedBatch, fetchBatchRows]);

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

  // ─── MST helpers ──────────────────────────────────────────

  /** Convert a local datetime-local string to a UTC ISO string assuming the input is MST (UTC-7) */
  const mstToUtc = (mstStr: string) => {
    // datetime-local gives "2026-02-24T09:30" — treat as MST = UTC-7
    const [datePart, timePart] = mstStr.split("T");
    const [yyyy, mm, dd] = datePart.split("-").map(Number);
    const [hh, mi] = timePart.split(":").map(Number);
    const mstDate = new Date(Date.UTC(yyyy, mm - 1, dd, hh + 7, mi)); // +7 to go from MST→UTC
    return mstDate.toISOString();
  };

  /** Format a UTC ISO string to MST for display */
  const utcToMstDisplay = (utcStr: string) => {
    const d = new Date(utcStr);
    return d.toLocaleString("en-US", {
      timeZone: "America/Denver",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " MST";
  };

  const scheduleBatch = async () => {
    if (!scheduleDate || !selectedBatch) return;
    const pending = batchRows.filter((r) => r.status === "pending");
    if (pending.length === 0) return;

    setScheduling(true);
    try {
      const utcTime = mstToUtc(scheduleDate);
      const res = await fetch(
        `${serverUrl}/api/uploads/batch/${selectedBatch.batch_id}/schedule`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ scheduledAt: utcTime }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchBatchRows(selectedBatch.batch_id);
      fetchBatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Scheduling failed");
    } finally {
      setScheduling(false);
    }
  };

  const unscheduleBatch = async () => {
    if (!selectedBatch) return;
    try {
      const res = await fetch(
        `${serverUrl}/api/uploads/batch/${selectedBatch.batch_id}/unschedule`,
        {
          method: "PUT",
          headers: authHeaders(),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchBatchRows(selectedBatch.batch_id);
      fetchBatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const unscheduleRow = async (uploadId: string) => {
    try {
      const res = await fetch(
        `${serverUrl}/api/uploads/${uploadId}/unschedule`,
        {
          method: "PUT",
          headers: authHeaders(),
        }
      );
      if (!res.ok) throw new Error("Cancel failed");
      if (selectedBatch) await fetchBatchRows(selectedBatch.batch_id);
      fetchBatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const scheduleRow = async (uploadId: string, mstDateStr: string) => {
    try {
      const utcTime = mstToUtc(mstDateStr);
      const res = await fetch(
        `${serverUrl}/api/uploads/${uploadId}/schedule`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ scheduledAt: utcTime }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (selectedBatch) await fetchBatchRows(selectedBatch.batch_id);
      fetchBatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Schedule failed");
    }
  };

  const goBack = () => {
    if (step === "call-dashboard") {
      setStep("select-data");
      setBatchRows([]);
      setSelectedBatch(null);
      setSearchQuery("");
      setDebouncedSearch("");
      setCurrentPage(1);
    } else if (step === "select-data") {
      setStep("select-flow");
      setSelectedFlow(null);
      setBatchSearch("");
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────

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

  const batchFilterFn = (b: Batch) => {
    if (!batchSearch.trim()) return true;
    const q = batchSearch.toLowerCase();
    const name = (b.batch_name || "").toLowerCase();
    const date = new Date(b.uploaded_at).toLocaleDateString().toLowerCase();
    const contacts = `${b.total_rows} contacts`.toLowerCase();
    return name.includes(q) || date.includes(q) || contacts.includes(q);
  };

  const batchesForFlow = selectedFlow
    ? {
        assigned: batches.filter((b) => b.flow_id === selectedFlow.id).filter(batchFilterFn),
        unassigned: batches.filter((b) => !b.flow_id && Number(b.pending) > 0).filter(batchFilterFn),
      }
    : { assigned: [], unassigned: [] };

  const totalBatchesForFlow = selectedFlow
    ? batches.filter((b) => b.flow_id === selectedFlow.id || (!b.flow_id && Number(b.pending) > 0)).length
    : 0;

  // Stats from server (always for full batch, not filtered)
  const { pending: pendingCount, calling: callingCount, completed: completedCount, scheduled: scheduledCount, nextScheduledAt: scheduledTime, total: totalCount } = batchStats;

  // Pagination derived from server totals
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  // ─── Render ───────────────────────────────────────────────────

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => { setStep("select-flow"); setSelectedFlow(null); setSelectedBatch(null); }}
          className="transition-colors cursor-pointer font-medium"
          style={{ color: step === "select-flow" ? "var(--text-primary)" : "var(--text-tertiary)" }}
        >
          Call Center
        </button>
        {selectedFlow && (
          <>
            <span style={{ color: "var(--text-tertiary)" }}>/</span>
            <button
              onClick={() => { setStep("select-data"); setSelectedBatch(null); }}
              className="transition-colors cursor-pointer font-medium"
              style={{ color: step === "select-data" ? "var(--text-primary)" : "var(--text-tertiary)" }}
            >
              {selectedFlow.name}
            </button>
          </>
        )}
        {selectedBatch && step === "call-dashboard" && (
          <>
            <span style={{ color: "var(--text-tertiary)" }}>/</span>
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
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
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Start Calling</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Select a conversation flow to use for your calls
              </p>
            </div>

            {flows.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
                <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3" style={{ background: "var(--accent-muted)" }}>
                  <svg className="w-5 h-5" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No active flows</h3>
                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                  You need at least one active conversation flow to start calling.
                </p>
                <Link
                  href="/flows"
                  className="inline-block px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                  style={{ background: "var(--accent)" }}
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
                      className="text-left rounded-xl border p-5 transition-all cursor-pointer group"
                      style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--bg-hover)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-primary)"; e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg transition-colors" style={{ color: "var(--text-primary)" }}>
                            {flow.name}
                          </h3>
                          <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                            {flow.description || "No description"}
                          </p>
                        </div>
                        <span className="text-xl ml-3 transition-colors" style={{ color: "var(--text-tertiary)" }}>→</span>
                      </div>
                      <div className="mt-4 flex items-center gap-3 text-xs">
                        <span style={{ color: "var(--text-tertiary)" }}>{flow.node_count} nodes</span>
                        {totalPending > 0 && (
                          <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "var(--warning)" }}>
                            ⏳ {totalPending} pending
                          </span>
                        )}
                        {totalCompleted > 0 && (
                          <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.12)", color: "var(--success)" }}>
                            ✅ {totalCompleted} done
                          </span>
                        )}
                        {flowBatches.length === 0 && (
                          <span style={{ color: "var(--text-tertiary)" }}>No data yet</span>
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
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Select Call Data</h1>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Choose an upload batch to call with{" "}
                  <span className="font-medium" style={{ color: "var(--accent)" }}>{selectedFlow.name}</span>
                </p>
              </div>
              <button onClick={goBack} className="text-sm transition-colors cursor-pointer" style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}>
                ← Back
              </button>
            </div>

            {/* Flow expects these variables */}
            {flowVariables.length > 0 && (
              <div className="rounded-lg px-4 py-3 border" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
                <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Flow expects these data fields:</p>
                <div className="flex flex-wrap gap-1.5">
                  {flowVariables.map((v) => (
                    <span key={v} className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Batch search */}
            {totalBatchesForFlow > 3 && (
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.65 4.65a7.5 7.5 0 0012 12z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search batches by name or date..."
                    value={batchSearch}
                    onChange={(e) => setBatchSearch(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none transition-all"
                    style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-primary)")}
                  />
                  {batchSearch && (
                    <button
                      onClick={() => setBatchSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
                  {batchesForFlow.assigned.length + batchesForFlow.unassigned.length === totalBatchesForFlow
                    ? `${totalBatchesForFlow} batches`
                    : `${batchesForFlow.assigned.length + batchesForFlow.unassigned.length} of ${totalBatchesForFlow} batches`}
                </span>
              </div>
            )}

            {batchesForFlow.assigned.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
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
                <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Unassigned contacts ({batchesForFlow.unassigned.length})
                </h2>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  Selecting a batch will assign it to{" "}
                  <span style={{ color: "var(--accent)" }}>{selectedFlow.name}</span>
                </p>
                {batchesForFlow.unassigned.map((b) => (
                  <BatchCard key={b.batch_id} batch={b} onSelect={selectBatch} assigned={false} fieldMatch={getFieldMatch(b.data_fields || [])} />
                ))}
              </div>
            )}

            {batchesForFlow.assigned.length === 0 && batchesForFlow.unassigned.length === 0 && !batchSearch && (
              <div className="rounded-xl border p-12 text-center" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
                <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3" style={{ background: "var(--accent-muted)" }}>
                  <svg className="w-5 h-5" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No contact data available</h3>
                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                  Create a contact list first, then come back here to start calling.
                </p>
                <Link
                  href="/uploads"
                  className="inline-block px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                  style={{ background: "var(--accent)" }}
                >
                  Go to Contacts →
                </Link>
              </div>
            )}

            {batchesForFlow.assigned.length === 0 && batchesForFlow.unassigned.length === 0 && batchSearch && (
              <div className="rounded-xl border p-8 text-center" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No batches match &quot;{batchSearch}&quot;</p>
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
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Call Dashboard</h1>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  {selectedFlow.name} · {totalCount} contacts
                </p>
              </div>
              <button onClick={goBack} className="text-sm transition-colors cursor-pointer" style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}>
                ← Back
              </button>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-5 gap-3">
              <StatCard label="Pending" value={pendingCount} color="warning" icon="⏳" />
              <StatCard label="Scheduled" value={scheduledCount} color="accent" icon="📅" />
              <StatCard label="Calling" value={callingCount} color="info" icon="📞" />
              <StatCard label="Completed" value={completedCount} color="success" icon="✅" />
              <StatCard label="Total" value={totalCount} color="default" icon="📊" />
            </div>

            {/* Call / Schedule actions */}
            {pendingCount > 0 && (
              <div className="rounded-xl border p-4 space-y-4" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
                {/* Call All Now */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium" style={{ color: "var(--text-primary)" }}>Ready to call {pendingCount} contacts</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      Calls will be made sequentially with a 2-second delay
                    </p>
                  </div>
                  <button
                    onClick={callAllPending}
                    disabled={callingAll}
                    className="px-5 py-2.5 text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "var(--success)" }}
                    onMouseEnter={(e) => !callingAll && (e.currentTarget.style.opacity = "0.9")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    {callingAll ? (
                      <><span className="animate-pulse">📞</span> Calling...</>
                    ) : (
                      <>📞 Call All Now</>
                    )}
                  </button>
                </div>

                {/* Schedule for later */}
                <div className="pt-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
                  <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>📅 Or schedule for later (MST)</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="px-3 py-2 rounded-lg text-sm focus:outline-none [color-scheme:dark]"
                      style={{ background: "var(--bg-hover)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    />
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Mountain Standard Time</span>
                    <button
                      onClick={scheduleBatch}
                      disabled={!scheduleDate || scheduling}
                      className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: "var(--accent)" }}
                    >
                      {scheduling ? (
                        <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Scheduling...</>
                      ) : (
                        <>📅 Schedule {pendingCount} Calls</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Scheduled banner */}
            {scheduledCount > 0 && scheduledTime && (
              <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: "var(--accent-muted)", border: "1px solid rgba(124,92,252,0.3)" }}>
                <div>
                  <p className="font-medium" style={{ color: "var(--accent)" }}>📅 {scheduledCount} call{scheduledCount > 1 ? "s" : ""} scheduled</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Fires at {utcToMstDisplay(scheduledTime)} — the server will auto-dial when the time arrives
                  </p>
                </div>
                <button
                  onClick={unscheduleBatch}
                  className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                  style={{ background: "var(--bg-hover)" }}
                >
                  ✕ Cancel Schedule
                </button>
              </div>
            )}

            {assigning && (
              <div className="p-3 rounded-lg text-sm animate-pulse" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                Assigning flow to batch...
              </div>
            )}

            {/* Search bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.65 4.65a7.5 7.5 0 0012 12z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none transition-all"
                  style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-primary)")}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
                {filteredTotal === totalCount
                  ? `${totalCount} contacts`
                  : `${filteredTotal} of ${totalCount} contacts`}
              </span>
            </div>

            {/* Contacts table */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Contact</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Status</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Outcome</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Summary</th>
                    <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider w-48" style={{ color: "var(--text-tertiary)" }}>Action</th>
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
                      <tr key={row.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{name}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                            {Object.entries(row.raw_data)
                              .filter(([k]) => !["name", "patient_name", "Name", "first_name"].includes(k))
                              .slice(0, 2)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--accent)" }}>{row.phone_number}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const sMap: Record<string, { bg: string; color: string; dot: string }> = {
                              pending:   { bg: "rgba(251,191,36,0.12)", color: "var(--warning)", dot: "var(--warning)" },
                              calling:   { bg: "rgba(96,165,250,0.12)", color: "var(--info)", dot: "var(--info)" },
                              completed: { bg: "rgba(52,211,153,0.12)", color: "var(--success)", dot: "var(--success)" },
                              failed:    { bg: "rgba(248,113,113,0.12)", color: "var(--danger)", dot: "var(--danger)" },
                              no_answer: { bg: "rgba(251,191,36,0.12)", color: "var(--warning)", dot: "var(--warning)" },
                              voicemail: { bg: "var(--accent-muted)", color: "var(--accent)", dot: "var(--accent)" },
                              scheduled: { bg: "var(--accent-muted)", color: "var(--accent)", dot: "var(--accent)" },
                            };
                            const st = sMap[row.status] || sMap.pending;
                            return (
                              <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                                {row.status === "scheduled" ? "📅 scheduled" : row.status}
                              </span>
                            );
                          })()}
                          {row.status === "calling" && (
                            <span className="ml-1.5 animate-pulse text-xs" style={{ color: "var(--info)" }}>●</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.outcome ? (
                            <span
                              className="text-[11px] px-2 py-0.5 rounded font-medium"
                              style={{
                                background: row.outcome.includes("change") ? "rgba(52,211,153,0.12)" :
                                  row.outcome.includes("fail") ? "rgba(248,113,113,0.12)" : "rgba(92,100,120,0.12)",
                                color: row.outcome.includes("change") ? "var(--success)" :
                                  row.outcome.includes("fail") ? "var(--danger)" : "var(--text-secondary)"
                              }}
                            >
                              {row.outcome}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-xs">
                          {row.call_summary ? (
                            <span style={{ color: "var(--text-secondary)" }}>{row.call_summary}</span>
                          ) : row.call_duration ? (
                            <span style={{ color: "var(--text-tertiary)" }}>{row.call_duration}s</span>
                          ) : (
                            <span style={{ color: "var(--text-tertiary)" }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.status === "pending" ? (
                            <RowActions
                              rowId={row.id}
                              calling={callingIds.has(row.id) || callingAll}
                              onCall={() => callUpload(row.id)}
                              onSchedule={(dt) => scheduleRow(row.id, dt)}
                            />
                          ) : row.status === "scheduled" ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px]" style={{ color: "var(--accent)" }}>
                                {row.scheduled_at ? utcToMstDisplay(row.scheduled_at) : "Scheduled"}
                              </span>
                              <button
                                onClick={() => unscheduleRow(row.id)}
                                className="px-2 py-1 text-white text-[10px] rounded transition-colors cursor-pointer"
                                style={{ background: "var(--bg-hover)" }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : row.status === "calling" ? (
                            <span className="text-xs animate-pulse" style={{ color: "var(--info)" }}>In progress</span>
                          ) : row.status === "completed" ? (
                            <span className="text-xs" style={{ color: "var(--success)" }}>Done</span>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{row.status}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalCount === 0 && (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>No contacts in this batch</div>
              )}
              {totalCount > 0 && filteredTotal === 0 && (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                  No contacts match &quot;{searchQuery}&quot;
                </div>
              )}
            </div>

            {/* Pagination controls */}
            {filteredTotal > pageSize && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredTotal)} of {filteredTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage <= 1}
                    className="px-2 py-1.5 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
                  >
                    ««
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                    .reduce<(number | "dot")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("dot");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "dot" ? (
                        <span key={`dot-${idx}`} className="px-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setCurrentPage(item as number)}
                          className="px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer"
                          style={{
                            background: safePage === item ? "var(--accent)" : "var(--bg-tertiary)",
                            border: safePage === item ? "1px solid var(--accent)" : "1px solid var(--border-primary)",
                            color: safePage === item ? "white" : "var(--text-secondary)",
                            fontWeight: safePage === item ? 600 : 400,
                          }}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
                  >
                    Next ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage >= totalPages}
                    className="px-2 py-1.5 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
                  >
                    »»
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
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
    <div
      className="w-full text-left rounded-xl border p-4 transition-all group"
      style={{
        background: "var(--bg-tertiary)",
        borderColor: hasMissing ? "rgba(251,191,36,0.4)" : "var(--border-primary)",
      }}
    >
      <button
        onClick={() => onSelect(batch)}
        className="w-full text-left cursor-pointer"
        onMouseEnter={(e) => { const parent = e.currentTarget.parentElement; if (parent) parent.style.borderColor = "var(--accent)"; }}
        onMouseLeave={(e) => { const parent = e.currentTarget.parentElement; if (parent) parent.style.borderColor = hasMissing ? "rgba(251,191,36,0.4)" : "var(--border-primary)"; }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="font-medium transition-colors" style={{ color: "var(--text-primary)" }}>
                {batch.batch_name || `${batch.total_rows} contacts`}
              </span>
              {batch.batch_name && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{batch.total_rows} contacts</span>}
              {assigned ? (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                  ✓ Assigned
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-hover)", color: "var(--text-tertiary)" }}>
                  Unassigned
                </span>
              )}
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {new Date(batch.uploaded_at).toLocaleDateString()}{" "}
                {new Date(batch.uploaded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              {pending > 0 && <span style={{ color: "var(--warning)" }}>⏳ {pending} pending</span>}
              {Number(batch.calling) > 0 && <span style={{ color: "var(--info)" }}>📞 {batch.calling} calling</span>}
              {Number(batch.scheduled || 0) > 0 && <span style={{ color: "var(--accent)" }}>📅 {batch.scheduled} scheduled</span>}
              {completed > 0 && <span style={{ color: "var(--success)" }}>✅ {completed} completed</span>}
              {Number(batch.failed) > 0 && <span style={{ color: "var(--danger)" }}>❌ {batch.failed} failed</span>}
              {Number(batch.no_answer) > 0 && <span style={{ color: "var(--warning)" }}>☎️ {batch.no_answer} no answer</span>}
            </div>
            {/* Progress bar */}
            {assigned && progress > 0 && (
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: "var(--accent)" }}
                />
              </div>
            )}
          </div>
          <span className="text-xl ml-4 transition-colors" style={{ color: "var(--text-tertiary)" }}>→</span>
        </div>
      </button>

      {/* Field matching indicator */}
      {fieldMatch && (fieldMatch.matched.length > 0 || fieldMatch.missing.length > 0) && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-secondary)" }}>
          <div className="flex flex-wrap gap-1.5">
            {fieldMatch.matched.map((f) => (
              <span key={f} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(52,211,153,0.12)", color: "var(--success)" }}>
                ✓ {f}
              </span>
            ))}
            {fieldMatch.missing.map((f) => (
              <span key={f} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.12)", color: "var(--warning)" }}>
                ✗ {f}
              </span>
            ))}
          </div>
          {hasMissing && (
            <p className="text-[11px] mt-1.5" style={{ color: "var(--warning)" }}>
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
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    warning: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", text: "var(--warning)" },
    info:    { bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)", text: "var(--info)" },
    success: { bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)", text: "var(--success)" },
    accent:  { bg: "var(--accent-muted)", border: "rgba(124,92,252,0.2)", text: "var(--accent)" },
    default: { bg: "var(--bg-tertiary)", border: "var(--border-primary)", text: "var(--text-secondary)" },
  };
  const c = colorMap[color] || colorMap.default;

  return (
    <div className="rounded-xl border p-4 text-center" style={{ background: c.bg, borderColor: c.border }}>
      <div className="text-2xl font-bold" style={{ color: c.text }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
        {icon} {label}
      </div>
    </div>
  );
}

/** Per-row actions: Call Now + Schedule toggle */
function RowActions({
  rowId,
  calling,
  onCall,
  onSchedule,
}: {
  rowId: string;
  calling: boolean;
  onCall: () => void;
  onSchedule: (mstDateTime: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [dt, setDt] = useState("");

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={onCall}
          disabled={calling}
          className="px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "var(--success)" }}
        >
          {calling ? "📞 ..." : "📞 Call"}
        </button>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="px-2 py-1.5 text-xs rounded-lg transition-colors cursor-pointer"
          style={{
            background: showPicker ? "var(--accent)" : "var(--bg-hover)",
            color: showPicker ? "white" : "var(--text-secondary)"
          }}
          title="Schedule this call"
        >
          📅
        </button>
      </div>
      {showPicker && (
        <div className="flex items-center gap-1.5">
          <input
            type="datetime-local"
            value={dt}
            onChange={(e) => setDt(e.target.value)}
            className="px-1.5 py-1 rounded text-[10px] focus:outline-none [color-scheme:dark] w-[145px]"
            style={{ background: "var(--bg-hover)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
          />
          <button
            disabled={!dt}
            onClick={() => { onSchedule(dt); setShowPicker(false); setDt(""); }}
            className="px-2 py-1 text-white text-[10px] rounded transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)" }}
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}
