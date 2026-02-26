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

type Campaign = {
  id: string;
  name: string;
  flow_id: string;
  batch_id: string;
  scheduled_at: string | null;
  max_concurrent: number;
  retry_no_answer: boolean;
  status: string;
  flow_name: string;
  batch_name: string | null;
  total_contacts: string;
  pending: string;
  calling: string;
  completed: string;
  failed: string;
  scheduled: string;
  skipped: string;
  no_answer: string;
  voicemail: string;
  with_outcome: string;
  created_at: string;
  updated_at: string;
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

// ─── View modes ───────────────────────────────────────────────────

type View = "list" | "detail";

export default function CampaignsPage() {
  const { user, token, loading, serverUrl, authHeaders } = useAuth();
  const router = useRouter();

  // View state
  const [view, setView] = useState<View>("list");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Campaigns list
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Wizard modal state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardName, setWizardName] = useState("");
  const [wizardFlow, setWizardFlow] = useState<Flow | null>(null);
  const [wizardBatch, setWizardBatch] = useState<Batch | null>(null);
  const [wizardSchedule, setWizardSchedule] = useState("");
  const [wizardMaxConcurrent, setWizardMaxConcurrent] = useState(1);
  const [wizardRetryNoAnswer, setWizardRetryNoAnswer] = useState(false);
  const [wizardCreating, setWizardCreating] = useState(false);

  // Data for wizard
  const [flows, setFlows] = useState<Flow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [flowVariables, setFlowVariables] = useState<string[]>([]);

  // Campaign detail state
  const [detailRows, setDetailRows] = useState<Upload[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [detailStats, setDetailStats] = useState({
    total: 0, pending: 0, calling: 0, completed: 0, scheduled: 0, failed: 0, nextScheduledAt: null as string | null,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const searchRef = useRef(debouncedSearch);
  const pageRef = useRef(currentPage);
  searchRef.current = debouncedSearch;
  pageRef.current = currentPage;

  // Call state
  const [callingIds, setCallingIds] = useState<Set<string>>(new Set());
  const [callingAll, setCallingAll] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // Debounce search
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

  // ─── Fetch Campaigns ──────────────────────────────────────────

  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${serverUrl}/api/campaigns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCampaigns(await res.json());
    } catch {}
  }, [token, serverUrl]);

  useEffect(() => {
    if (token && user) fetchCampaigns();
  }, [token, user, fetchCampaigns]);

  // ─── Fetch Flows & Batches (for wizard) ───────────────────────

  const fetchFlows = useCallback(async () => {
    if (!token || !user) return;
    try {
      const res = await fetch(`${serverUrl}/api/flows?userId=${user.id}`);
      const data = await res.json();
      setFlows(Array.isArray(data) ? data.filter((f: Flow) => f.is_active) : []);
    } catch {}
  }, [token, serverUrl, user]);

  const fetchBatches = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${serverUrl}/api/uploads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBatches(await res.json());
    } catch {}
  }, [token, serverUrl]);

  // ─── Fetch Campaign Detail ───────────────────────────────────

  const fetchCampaignDetail = useCallback(async (campaignId: string, search?: string, page?: number) => {
    if (!token) return;
    const s = search ?? searchRef.current;
    const p = page ?? pageRef.current;
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (s) params.set("search", s);
      const res = await fetch(`${serverUrl}/api/campaigns/${campaignId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDetailRows(data.rows);
        setFilteredTotal(data.filteredTotal);
        setDetailStats(data.stats);
      }
    } catch {}
  }, [token, serverUrl]);

  // Re-fetch when search or page changes
  useEffect(() => {
    if (view !== "detail" || !selectedCampaign) return;
    fetchCampaignDetail(selectedCampaign.id, debouncedSearch, currentPage);
  }, [debouncedSearch, currentPage, view, selectedCampaign, fetchCampaignDetail]);

  // Auto-refresh while viewing detail
  useEffect(() => {
    if (view !== "detail" || !selectedCampaign) return;
    const id = setInterval(() => fetchCampaignDetail(selectedCampaign.id), 5000);
    return () => clearInterval(id);
  }, [view, selectedCampaign, fetchCampaignDetail]);

  // ─── Campaign Actions ────────────────────────────────────────

  const openCampaign = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setSearchQuery("");
    setDebouncedSearch("");
    setCurrentPage(1);
    setView("detail");
    await fetchCampaignDetail(campaign.id, "", 1);
  };

  const goBackToList = () => {
    setView("list");
    setSelectedCampaign(null);
    setDetailRows([]);
    setSearchQuery("");
    setDebouncedSearch("");
    setCurrentPage(1);
    fetchCampaigns();
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm("Delete this campaign? The contact data will not be deleted.")) return;
    try {
      await fetch(`${serverUrl}/api/campaigns/${campaignId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCampaigns();
      if (selectedCampaign?.id === campaignId) goBackToList();
    } catch {}
  };

  // ─── Wizard ──────────────────────────────────────────────────

  const openWizard = () => {
    setWizardStep(1);
    setWizardName("");
    setWizardFlow(null);
    setWizardBatch(null);
    setWizardSchedule("");
    setWizardMaxConcurrent(1);
    setWizardRetryNoAnswer(false);
    setWizardCreating(false);
    setFlowVariables([]);
    setShowWizard(true);
    fetchFlows();
    fetchBatches();
  };

  // Fetch flow variables when a flow is selected
  const fetchFlowVariables = useCallback(async (flowId: string) => {
    try {
      const res = await fetch(`${serverUrl}/api/flows/${flowId}/variables`);
      if (res.ok) {
        const data = await res.json();
        setFlowVariables(data.variables || []);
      }
    } catch {
      setFlowVariables([]);
    }
  }, [serverUrl]);

  const closeWizard = () => {
    setShowWizard(false);
  };

  const createCampaign = async () => {
    if (!wizardName || !wizardFlow || !wizardBatch) return;
    setWizardCreating(true);
    try {
      const body: Record<string, string | number | boolean> = {
        name: wizardName,
        flowId: wizardFlow.id,
        batchId: wizardBatch.batch_id,
        maxConcurrent: wizardMaxConcurrent,
        retryNoAnswer: wizardRetryNoAnswer,
      };
      if (wizardSchedule) {
        body.scheduledAt = mstToUtc(wizardSchedule);
      }
      const res = await fetch(`${serverUrl}/api/campaigns`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      closeWizard();
      fetchCampaigns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setWizardCreating(false);
    }
  };

  // ─── Call Actions ────────────────────────────────────────────

  const callUpload = async (uploadId: string) => {
    setCallingIds((prev) => new Set(prev).add(uploadId));
    try {
      const res = await fetch(`${serverUrl}/call-upload/${uploadId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (selectedCampaign) await fetchCampaignDetail(selectedCampaign.id);
      fetchCampaigns();
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
    const pending = detailRows.filter((r) => r.status === "pending");
    if (pending.length === 0) return;
    if (!confirm(`Start calling ${pending.length} pending contacts?`)) return;

    const maxC = selectedCampaign?.max_concurrent || 1;
    const shouldRetry = selectedCampaign?.retry_no_answer || false;

    setCallingAll(true);

    // Process in batches of maxC concurrent calls
    for (let i = 0; i < pending.length; i += maxC) {
      const batch = pending.slice(i, i + maxC);
      await Promise.all(batch.map((row) => callUpload(row.id)));
      // Small delay between batches
      if (i + maxC < pending.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // Retry no_answer contacts if enabled
    if (shouldRetry && selectedCampaign) {
      await fetchCampaignDetail(selectedCampaign.id);
      // After re-fetch, check for no_answer rows (use fresh data)
      const retryRes = await fetch(`${serverUrl}/api/campaigns/${selectedCampaign.id}?pageSize=500`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        const noAnswerRows = (retryData.rows || []).filter((r: Upload) => r.status === "no_answer");
        if (noAnswerRows.length > 0) {
          // Reset no_answer rows to pending, then retry
          for (const row of noAnswerRows) {
            try {
              await fetch(`${serverUrl}/api/uploads/${row.id}/status`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify({ status: "pending" }),
              });
            } catch {}
          }
          // Call them again with concurrency
          for (let i = 0; i < noAnswerRows.length; i += maxC) {
            const batch = noAnswerRows.slice(i, i + maxC);
            await Promise.all(batch.map((row: Upload) => callUpload(row.id)));
            if (i + maxC < noAnswerRows.length) {
              await new Promise((r) => setTimeout(r, 2000));
            }
          }
        }
      }
    }

    setCallingAll(false);
  };

  // ─── MST helpers ──────────────────────────────────────────

  const mstToUtc = (mstStr: string) => {
    const [datePart, timePart] = mstStr.split("T");
    const [yyyy, mm, dd] = datePart.split("-").map(Number);
    const [hh, mi] = timePart.split(":").map(Number);
    const mstDate = new Date(Date.UTC(yyyy, mm - 1, dd, hh + 7, mi));
    return mstDate.toISOString();
  };

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
    if (!scheduleDate || !selectedCampaign) return;
    const pending = detailRows.filter((r) => r.status === "pending");
    if (pending.length === 0) return;

    setScheduling(true);
    try {
      const utcTime = mstToUtc(scheduleDate);
      const res = await fetch(
        `${serverUrl}/api/uploads/batch/${selectedCampaign.batch_id}/schedule`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ scheduledAt: utcTime }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (selectedCampaign) await fetchCampaignDetail(selectedCampaign.id);
      fetchCampaigns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Scheduling failed");
    } finally {
      setScheduling(false);
    }
  };

  const unscheduleBatch = async () => {
    if (!selectedCampaign) return;
    try {
      const res = await fetch(
        `${serverUrl}/api/uploads/batch/${selectedCampaign.batch_id}/unschedule`,
        {
          method: "PUT",
          headers: authHeaders(),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (selectedCampaign) await fetchCampaignDetail(selectedCampaign.id);
      fetchCampaigns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const unscheduleRow = async (uploadId: string) => {
    try {
      const res = await fetch(
        `${serverUrl}/api/uploads/${uploadId}/unschedule`,
        { method: "PUT", headers: authHeaders() }
      );
      if (!res.ok) throw new Error("Cancel failed");
      if (selectedCampaign) await fetchCampaignDetail(selectedCampaign.id);
      fetchCampaigns();
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
      if (selectedCampaign) await fetchCampaignDetail(selectedCampaign.id);
      fetchCampaigns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Schedule failed");
    }
  };

  // ─── Derived ──────────────────────────────────────────────────

  const { pending: pendingCount, calling: callingCount, completed: completedCount, scheduled: scheduledCount, nextScheduledAt: scheduledTime, total: totalCount } = detailStats;
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

      {/* ═══════════════════════════════════════════════════════
          CAMPAIGNS LIST VIEW
      ═══════════════════════════════════════════════════════ */}
      {view === "list" && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Campaigns</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Manage your outbound call campaigns
              </p>
            </div>
            <button
              onClick={openWizard}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all cursor-pointer"
              style={{ background: "var(--accent)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Campaign
            </button>
          </div>

          {/* Campaigns Table */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
            {campaigns.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--accent-muted)" }}>
                  <svg className="w-6 h-6" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
                  </svg>
                </div>
                <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>No campaigns yet</p>
                <p className="text-xs mb-5" style={{ color: "var(--text-tertiary)" }}>
                  Create a campaign to start calling your contacts with an AI flow
                </p>
                <button
                  onClick={openWizard}
                  className="inline-block px-5 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
                  style={{ background: "var(--accent)" }}
                >
                  Create Your First Campaign
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                    <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Campaign</th>
                    <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-tertiary)" }}>Flow</th>
                    <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-tertiary)" }}>Contacts</th>
                    <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Progress</th>
                    <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-tertiary)" }}>Status</th>
                    <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-tertiary)" }}>Created</th>
                    <th className="text-right px-5 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const total = Number(c.total_contacts);
                    const done = Number(c.completed);
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    const calling = Number(c.calling);
                    const pending = Number(c.pending);
                    const sched = Number(c.scheduled);
                    const statusLabel = calling > 0 ? "In Progress" : sched > 0 ? "Scheduled" : pending > 0 && done === 0 ? "Ready" : done === total && total > 0 ? "Completed" : pending > 0 ? "Partial" : "Draft";
                    const statusStyle = calling > 0
                      ? { bg: "rgba(96,165,250,0.12)", color: "var(--info)", dot: "var(--info)" }
                      : sched > 0
                      ? { bg: "var(--accent-muted)", color: "var(--accent)", dot: "var(--accent)" }
                      : done === total && total > 0
                      ? { bg: "rgba(52,211,153,0.12)", color: "var(--success)", dot: "var(--success)" }
                      : pending > 0
                      ? { bg: "rgba(251,191,36,0.12)", color: "var(--warning)", dot: "var(--warning)" }
                      : { bg: "rgba(92,100,120,0.12)", color: "var(--text-tertiary)", dot: "var(--text-tertiary)" };

                    return (
                      <tr
                        key={c.id}
                        className="transition-colors cursor-pointer"
                        style={{ borderBottom: "1px solid var(--border-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => openCampaign(c)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{c.batch_name || "—"}</div>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                            {c.flow_name}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>{total}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 rounded-full max-w-[100px]" style={{ background: "var(--bg-hover)" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                            </div>
                            <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>{pct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ background: statusStyle.bg, color: statusStyle.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell text-xs" style={{ color: "var(--text-tertiary)" }}>
                          {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }}
                            className="p-1.5 rounded-lg transition-colors cursor-pointer"
                            style={{ color: "var(--text-tertiary)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(248,113,113,0.1)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
                            title="Delete campaign"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          CAMPAIGN DETAIL VIEW (Call Dashboard)
      ═══════════════════════════════════════════════════════ */}
      {view === "detail" && selectedCampaign && (
        <div className="space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <button onClick={goBackToList} className="transition-colors cursor-pointer font-medium" style={{ color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}>
              Campaigns
            </button>
            <span style={{ color: "var(--text-tertiary)" }}>/</span>
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{selectedCampaign.name}</span>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{selectedCampaign.name}</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                {selectedCampaign.flow_name} · {totalCount} contacts
              </p>
            </div>
            <button onClick={goBackToList} className="text-sm transition-colors cursor-pointer" style={{ color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}>
              ← Back to Campaigns
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: "var(--text-primary)" }}>Ready to call {pendingCount} contacts</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {(selectedCampaign?.max_concurrent || 1) > 1
                      ? `${selectedCampaign?.max_concurrent} concurrent calls`
                      : "Sequential calls"
                    }
                    {selectedCampaign?.retry_no_answer && " · Retry unanswered"}
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
                    {scheduling ? "Scheduling..." : `📅 Schedule ${pendingCount} Calls`}
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
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer" style={{ color: "var(--text-tertiary)" }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
              {filteredTotal === totalCount ? `${totalCount} contacts` : `${filteredTotal} of ${totalCount} contacts`}
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
                {detailRows.map((row) => {
                  const name = row.raw_data.name || row.raw_data.patient_name || row.raw_data.Name || row.raw_data.first_name || row.raw_data.firstname || "—";
                  return (
                    <tr key={row.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border-secondary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{name}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                          {Object.entries(row.raw_data)
                            .filter(([k]) => !["name", "patient_name", "Name", "first_name", "firstname"].includes(k))
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
                          <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{
                            background: row.outcome.includes("change") ? "rgba(52,211,153,0.12)" :
                              row.outcome.includes("fail") ? "rgba(248,113,113,0.12)" : "rgba(92,100,120,0.12)",
                            color: row.outcome.includes("change") ? "var(--success)" :
                              row.outcome.includes("fail") ? "var(--danger)" : "var(--text-secondary)"
                          }}>{row.outcome}</span>
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
                            <button onClick={() => unscheduleRow(row.id)} className="px-2 py-1 text-white text-[10px] rounded transition-colors cursor-pointer" style={{ background: "var(--bg-hover)" }}>Cancel</button>
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
              <div className="p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>No contacts in this campaign</div>
            )}
            {totalCount > 0 && filteredTotal === 0 && (
              <div className="p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                No contacts match &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredTotal > pageSize && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredTotal)} of {filteredTotal}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(1)} disabled={safePage <= 1}
                  className="px-2 py-1.5 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
                  ««
                </button>
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                  className="px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
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
                      <button key={item} onClick={() => setCurrentPage(item as number)}
                        className="px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer"
                        style={{
                          background: safePage === item ? "var(--accent)" : "var(--bg-tertiary)",
                          border: safePage === item ? "1px solid var(--accent)" : "1px solid var(--border-primary)",
                          color: safePage === item ? "white" : "var(--text-secondary)",
                          fontWeight: safePage === item ? 600 : 400,
                        }}>
                        {item}
                      </button>
                    )
                  )}
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                  className="px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
                  Next ›
                </button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={safePage >= totalPages}
                  className="px-2 py-1.5 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
                  »»
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          ADD CAMPAIGN WIZARD MODAL
      ═══════════════════════════════════════════════════════ */}
      {showWizard && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={closeWizard} />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>New Campaign</h2>
              <button onClick={closeWizard} className="p-1 rounded-lg transition-colors cursor-pointer" style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stepper */}
            <div className="px-6 py-3 flex items-center" style={{ borderBottom: "1px solid var(--border-secondary)" }}>
              {["Name", "Flow", "Contacts", "Schedule"].map((label, i) => {
                const stepNum = i + 1;
                const isActive = wizardStep === stepNum;
                const isDone = wizardStep > stepNum;
                return (
                  <div key={label} className="contents">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={{
                          background: isDone ? "rgba(52,211,153,0.15)" : isActive ? "var(--accent-muted)" : "var(--bg-hover)",
                          border: isDone ? "1.5px solid var(--success)" : isActive ? "1.5px solid var(--accent)" : "1.5px solid var(--border-primary)",
                          color: isDone ? "var(--success)" : isActive ? "var(--accent)" : "var(--text-tertiary)",
                        }}
                      >
                        {isDone ? "✓" : stepNum}
                      </div>
                      <span className="text-[13px] font-medium hidden sm:inline" style={{ color: isDone ? "var(--success)" : isActive ? "var(--accent)" : "var(--text-tertiary)" }}>{label}</span>
                    </div>
                    {i < 3 && (
                      <div className="flex-1 h-px mx-3" style={{ background: isDone ? "var(--success)" : "var(--border-primary)" }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 max-h-[55vh] overflow-y-auto">
              {/* Step 1: Name */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Campaign Name</label>
                    <input
                      type="text"
                      value={wizardName}
                      onChange={(e) => setWizardName(e.target.value)}
                      placeholder="e.g. February Refill Reminders"
                      className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none"
                      style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-primary)")}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter" && wizardName.trim()) setWizardStep(2); }}
                    />
                    <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
                      Give your campaign a descriptive name so you can find it later.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Select Flow */}
              {wizardStep === 2 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Select a conversation flow</p>
                  {flows.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>No active flows available</p>
                      <Link href="/flows" className="text-sm font-medium" style={{ color: "var(--accent)" }}>Go to Flows →</Link>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[35vh] overflow-y-auto">
                      {flows.map((flow) => (
                        <button
                          key={flow.id}
                          onClick={() => { setWizardFlow(flow); setWizardBatch(null); fetchFlowVariables(flow.id); }}
                          className="w-full text-left rounded-lg border p-4 transition-all cursor-pointer"
                          style={{
                            background: wizardFlow?.id === flow.id ? "var(--accent-muted)" : "var(--bg-tertiary)",
                            borderColor: wizardFlow?.id === flow.id ? "var(--accent)" : "var(--border-primary)",
                          }}
                          onMouseEnter={(e) => { if (wizardFlow?.id !== flow.id) e.currentTarget.style.borderColor = "var(--accent)"; }}
                          onMouseLeave={(e) => { if (wizardFlow?.id !== flow.id) e.currentTarget.style.borderColor = "var(--border-primary)"; }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{flow.name}</div>
                              <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                {flow.description || "No description"} · {flow.node_count} nodes
                              </div>
                            </div>
                            {wizardFlow?.id === flow.id && (
                              <span className="text-sm" style={{ color: "var(--accent)" }}>✓</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Select Contacts (existing upload) */}
              {wizardStep === 3 && (() => {
                // Compute match info for each batch
                const batchMatchInfo = batches.map((batch) => {
                  const fields = (batch.data_fields || []).map((f) => f.toLowerCase());
                  const matched = flowVariables.filter((v) => fields.includes(v.toLowerCase()));
                  const missing = flowVariables.filter((v) => !fields.includes(v.toLowerCase()));
                  const isCompatible = flowVariables.length === 0 || missing.length === 0;
                  return { batch, matched, missing, isCompatible };
                });

                return (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Select a contact list</p>
                      {flowVariables.length > 0 && (
                        <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
                          Flow expects: {flowVariables.map((v, i) => (
                            <span key={v}>
                              <span className="font-mono px-1 py-0.5 rounded" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>{`{${v}}`}</span>
                              {i < flowVariables.length - 1 ? " " : ""}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                    {batches.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>No contact lists uploaded yet</p>
                        <Link href="/uploads" className="text-sm font-medium" style={{ color: "var(--accent)" }}>Go to Contacts →</Link>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[35vh] overflow-y-auto">
                        {batchMatchInfo.map(({ batch, matched, missing, isCompatible }) => {
                          const total = Number(batch.total_rows);
                          const pending = Number(batch.pending);
                          const isSelected = wizardBatch?.batch_id === batch.batch_id;

                          return (
                            <button
                              key={batch.batch_id}
                              onClick={() => isCompatible && setWizardBatch(batch)}
                              className={`w-full text-left rounded-lg border p-4 transition-all ${isCompatible ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                              style={{
                                background: isSelected ? "var(--accent-muted)" : !isCompatible ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                                borderColor: isSelected ? "var(--accent)" : !isCompatible ? "rgba(248,113,113,0.3)" : "var(--border-primary)",
                              }}
                              onMouseEnter={(e) => { if (!isSelected && isCompatible) e.currentTarget.style.borderColor = "var(--accent)"; }}
                              onMouseLeave={(e) => { if (!isSelected && isCompatible) e.currentTarget.style.borderColor = "var(--border-primary)"; if (!isCompatible) e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                                    {batch.batch_name || `Upload ${new Date(batch.uploaded_at).toLocaleDateString()}`}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                                    <span style={{ color: "var(--text-secondary)" }}>{total} contacts</span>
                                    {pending > 0 && <span style={{ color: "var(--warning)" }}>⏳ {pending} pending</span>}
                                    {Number(batch.completed) > 0 && <span style={{ color: "var(--success)" }}>✅ {batch.completed} completed</span>}
                                    {batch.flow_name && <span style={{ color: "var(--text-tertiary)" }}>Flow: {batch.flow_name}</span>}
                                  </div>
                                  {/* Field match indicators */}
                                  {flowVariables.length > 0 && (
                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                      {isCompatible ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(52,211,153,0.12)", color: "var(--success)" }}>
                                          ✓ All fields match
                                        </span>
                                      ) : (
                                        <>
                                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
                                            ✕ Missing: {missing.join(", ")}
                                          </span>
                                          {matched.length > 0 && (
                                            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                              ({matched.length}/{flowVariables.length} matched)
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <span className="text-sm flex-shrink-0" style={{ color: "var(--accent)" }}>✓</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Step 4: Schedule (optional) */}
              {wizardStep === 4 && (
                <div className="space-y-5">
                  {/* Max Concurrent Calls */}
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Max Concurrent Calls</p>
                    <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
                      How many calls can run at the same time. Higher = faster but may hit carrier limits.
                    </p>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 5, 10].map((n) => (
                        <button
                          key={n}
                          onClick={() => setWizardMaxConcurrent(n)}
                          className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer"
                          style={{
                            background: wizardMaxConcurrent === n ? "var(--accent)" : "var(--bg-tertiary)",
                            border: wizardMaxConcurrent === n ? "1px solid var(--accent)" : "1px solid var(--border-primary)",
                            color: wizardMaxConcurrent === n ? "white" : "var(--text-secondary)",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Retry No Answer */}
                  <div className="rounded-lg border p-4" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Retry unanswered calls</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                          Automatically retry contacts who don&apos;t pick up the first time
                        </p>
                      </div>
                      <button
                        onClick={() => setWizardRetryNoAnswer(!wizardRetryNoAnswer)}
                        className="relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0"
                        style={{ background: wizardRetryNoAnswer ? "var(--accent)" : "var(--bg-hover)" }}
                      >
                        <div
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                          style={{ transform: wizardRetryNoAnswer ? "translateX(22px)" : "translateX(2px)" }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Schedule calls (optional)</p>
                    <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
                      Schedule all pending calls for a specific time, or skip to call manually later.
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="datetime-local"
                        value={wizardSchedule}
                        onChange={(e) => setWizardSchedule(e.target.value)}
                        className="px-4 py-3 rounded-lg text-sm focus:outline-none [color-scheme:dark]"
                        style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                      />
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>MST (Mountain Standard Time)</span>
                    </div>
                    {wizardSchedule && (
                      <button
                        onClick={() => setWizardSchedule("")}
                        className="text-xs mt-2 transition-colors cursor-pointer"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        ✕ Clear schedule (I&apos;ll call manually)
                      </button>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="rounded-lg border p-4 space-y-2" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Campaign Summary</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span style={{ color: "var(--text-secondary)" }}>Name:</span>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{wizardName}</span>
                      <span style={{ color: "var(--text-secondary)" }}>Flow:</span>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{wizardFlow?.name}</span>
                      <span style={{ color: "var(--text-secondary)" }}>Contacts:</span>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {wizardBatch?.batch_name || "Upload"} ({wizardBatch?.total_rows} contacts)
                      </span>
                      <span style={{ color: "var(--text-secondary)" }}>Concurrent:</span>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{wizardMaxConcurrent} call{wizardMaxConcurrent > 1 ? "s" : ""} at a time</span>
                      <span style={{ color: "var(--text-secondary)" }}>Retry:</span>
                      <span className="font-medium" style={{ color: wizardRetryNoAnswer ? "var(--accent)" : "var(--text-tertiary)" }}>
                        {wizardRetryNoAnswer ? "Yes — retry unanswered" : "No retries"}
                      </span>
                      <span style={{ color: "var(--text-secondary)" }}>Schedule:</span>
                      <span className="font-medium" style={{ color: wizardSchedule ? "var(--accent)" : "var(--text-tertiary)" }}>
                        {wizardSchedule ? utcToMstDisplay(mstToUtc(wizardSchedule)) : "Manual (no schedule)"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-primary)" }}>
              <button
                onClick={wizardStep === 1 ? closeWizard : () => setWizardStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
              >
                {wizardStep === 1 ? "Cancel" : "← Back"}
              </button>

              {wizardStep < 4 ? (
                <button
                  onClick={() => setWizardStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                  disabled={
                    (wizardStep === 1 && !wizardName.trim()) ||
                    (wizardStep === 2 && !wizardFlow) ||
                    (wizardStep === 3 && !wizardBatch)
                  }
                  className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "var(--accent)" }}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={createCampaign}
                  disabled={wizardCreating}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "var(--accent)" }}
                >
                  {wizardCreating ? "Creating..." : "Create Campaign"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
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
      <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{icon} {label}</div>
    </div>
  );
}

function RowActions({ rowId, calling, onCall, onSchedule }: { rowId: string; calling: boolean; onCall: () => void; onSchedule: (mstDateTime: string) => void }) {
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
