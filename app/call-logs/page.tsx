"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useAuth } from "@/lib/auth-context";


/* ── Types ───────────────────────────────────────────────────────── */
interface CallLog {
  id: string;
  phone_number: string;
  raw_data: Record<string, string>;
  status: string;
  outcome: string | null;
  call_summary: string | null;
  call_duration: number | null;
  called_at: string | null;
  call_data: Record<string, unknown> | null;
  batch_id: string;
  campaign_name: string | null;
  campaign_id: string | null;
  flow_name: string | null;
}

interface CampaignOption {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  confirmed: number;
  voicemail: number;
  failed: number;
  noAnswer: number;
  avgDuration: number;
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function contactName(raw: Record<string, string>): string {
  return raw.name || raw.patient_name || raw.Name || raw.first_name || raw.firstname || "Unknown";
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function outcomeLabel(outcome: string | null, status: string): string {
  if (status === "voicemail") return "Voicemail";
  if (status === "no_answer") return "No Answer";
  if (status === "failed") return "Failed";
  if (!outcome) return status === "completed" ? "Completed" : status;
  // Clean up outcome text
  const o = outcome.toLowerCase();
  if (o.includes("confirm") || o.includes("change") || o.includes("success")) return "Confirmed";
  if (o.includes("voicemail")) return "Voicemail";
  if (o.includes("fail") || o.includes("refused")) return "Failed";
  if (o.includes("reschedul")) return "Rescheduled";
  if (o.includes("no_answer") || o.includes("no answer")) return "No Answer";
  // Capitalize first letter
  return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}

function outcomeStyle(label: string): { color: string; bg: string } {
  switch (label) {
    case "Confirmed":
      return { color: "var(--success)", bg: "rgba(52,211,153,0.12)" };
    case "Voicemail":
      return { color: "var(--warning)", bg: "rgba(251,191,36,0.12)" };
    case "Failed":
      return { color: "var(--danger)", bg: "rgba(248,113,113,0.12)" };
    case "Rescheduled":
      return { color: "var(--info)", bg: "rgba(96,165,250,0.12)" };
    case "No Answer":
      return { color: "var(--warning)", bg: "rgba(251,191,36,0.12)" };
    default:
      return { color: "var(--text-tertiary)", bg: "var(--bg-hover)" };
  }
}

/* ── Stat Card ───────────────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    info: "var(--info)",
    accent: "var(--accent)",
    default: "var(--text-secondary)",
  };
  const c = colorMap[color] || colorMap.default;
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
    >
      <div className="text-xs font-medium mb-1" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: c }}>
        {value}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function CallLogsPage() {
  const { token, serverUrl } = useAuth();

  // Data
  const [rows, setRows] = useState<CallLog[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, voicemail: 0, failed: 0, noAnswer: 0, avgDuration: 0 });
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // UI
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  /* ── Fetch ──────────────────────────────────────────────────────── */
  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (outcomeFilter) params.set("outcome", outcomeFilter);
      if (campaignFilter) params.set("campaign", campaignFilter);
      params.set("page", String(safePage));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`${serverUrl}/api/call-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch call logs");
      const data = await res.json();
      setRows(data.rows || []);
      setCampaigns(data.campaigns || []);
      setStats(data.stats || { total: 0, confirmed: 0, voicemail: 0, failed: 0, noAnswer: 0, avgDuration: 0 });
      setFilteredTotal(data.filteredTotal || 0);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Call logs fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [token, serverUrl, search, outcomeFilter, campaignFilter, safePage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, outcomeFilter, campaignFilter]);

  /* ── Export CSV ─────────────────────────────────────────────────── */
  const handleExport = () => {
    if (rows.length === 0) return;
    const headers = ["Contact", "Phone", "Campaign", "Duration", "Outcome", "Summary", "Time"];
    const csvRows = rows.map((r) => [
      contactName(r.raw_data),
      r.phone_number,
      r.campaign_name || "—",
      formatDuration(r.call_duration),
      outcomeLabel(r.outcome, r.status),
      (r.call_summary || "").replace(/"/g, '""'),
      r.called_at ? new Date(r.called_at).toISOString() : "",
    ]);
    const csv = [headers.join(","), ...csvRows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Call Logs
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Review individual call records and transcripts
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer"
          style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-secondary)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-tertiary)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Export
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Calls" value={stats.total} color="default" />
        <StatCard label="Confirmed" value={stats.confirmed} color="success" />
        <StatCard label="Voicemail" value={stats.voicemail} color="warning" />
        <StatCard label="Failed" value={stats.failed} color="danger" />
        <StatCard label="No Answer" value={stats.noAnswer} color="warning" />
        <StatCard label="Avg Duration" value={stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : "—"} color="info" />
      </div>

      {/* Toolbar - search + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--text-tertiary)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.65 4.65a7.5 7.5 0 0012 12z" />
          </svg>
          <input
            type="text"
            placeholder="Search by contact or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none transition-all"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-primary)")}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
              style={{ color: "var(--text-tertiary)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Outcome filter */}
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg text-sm focus:outline-none cursor-pointer"
          style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
            minWidth: 150,
          }}
        >
          <option value="">All Outcomes</option>
          <option value="confirm">Confirmed</option>
          <option value="voicemail">Voicemail</option>
          <option value="fail">Failed</option>
          <option value="no_answer">No Answer</option>
          <option value="reschedul">Rescheduled</option>
        </select>

        {/* Campaign filter */}
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg text-sm focus:outline-none cursor-pointer"
          style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
            minWidth: 170,
          }}
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Count label */}
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
          {filteredTotal === total ? `${total} calls` : `${filteredTotal} of ${total} calls`}
        </span>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Contact
              </th>
              <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Campaign
              </th>
              <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Duration
              </th>
              <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Outcome
              </th>
              <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Time
              </th>
              <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)", width: 120 }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const name = contactName(row.raw_data);
              const label = outcomeLabel(row.outcome, row.status);
              const os = outcomeStyle(label);
              const expanded = expandedRow === row.id;

              return (
                <Fragment key={row.id}>
                  <tr
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--border-secondary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Contact: name + phone (like reference) */}
                    <td className="px-4 py-3">
                      <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{name}</div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                      >
                        {row.phone_number}
                      </div>
                    </td>

                    {/* Campaign */}
                    <td className="px-4 py-3" style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                      {row.campaign_name || "—"}
                    </td>

                    {/* Duration */}
                    <td
                      className="px-4 py-3"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: "var(--text-primary)" }}
                    >
                      {formatDuration(row.call_duration)}
                    </td>

                    {/* Outcome badge */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center"
                        style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 500,
                          color: os.color,
                          background: os.bg,
                        }}
                      >
                        {label}
                      </span>
                    </td>

                    {/* Time */}
                    <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {formatTime(row.called_at)}
                    </td>

                    {/* Actions: Transcript + Play */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {row.call_summary && (
                          <button
                            onClick={() => setExpandedRow(expanded ? null : row.id)}
                            className="px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer"
                            style={{
                              background: expanded ? "var(--accent-muted)" : "transparent",
                              color: expanded ? "var(--accent)" : "var(--text-secondary)",
                              border: "1px solid var(--border-primary)",
                              fontSize: 11.5,
                            }}
                            onMouseEnter={(e) => {
                              if (!expanded) {
                                e.currentTarget.style.background = "var(--bg-hover)";
                                e.currentTarget.style.color = "var(--text-primary)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!expanded) {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "var(--text-secondary)";
                              }
                            }}
                          >
                            Transcript
                          </button>
                        )}
                        <button
                          className="p-1.5 rounded-lg transition-colors cursor-pointer"
                          style={{
                            color: "var(--text-tertiary)",
                            border: "1px solid var(--border-primary)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--bg-hover)";
                            e.currentTarget.style.color = "var(--text-primary)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "var(--text-tertiary)";
                          }}
                          title="Play recording"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded transcript row */}
                  {expanded && row.call_summary && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-4"
                        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-secondary)" }}
                      >
                        <div className="flex items-start gap-3">
                          <svg
                            className="w-4 h-4 mt-0.5 flex-shrink-0"
                            style={{ color: "var(--accent)" }}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.7}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                            />
                          </svg>
                          <div>
                            <div className="text-xs font-medium mb-1" style={{ color: "var(--accent)" }}>
                              Call Summary
                            </div>
                            <div className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {row.call_summary}
                            </div>
                            {row.outcome && (
                              <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                                Outcome: {row.outcome}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Empty states */}
        {loading && (
          <div className="p-12 text-center">
            <div className="animate-pulse text-sm" style={{ color: "var(--text-tertiary)" }}>
              Loading call logs...
            </div>
          </div>
        )}
        {!loading && total === 0 && (
          <div className="p-12 text-center">
            <div className="text-3xl mb-3">📞</div>
            <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              No call logs yet
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              Call logs will appear here after you run campaigns
            </div>
          </div>
        )}
        {!loading && total > 0 && filteredTotal === 0 && (
          <div className="p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            No calls match your filters
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
                  <span key={`dot-${idx}`} className="px-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    …
                  </span>
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
          </div>
        </div>
      )}
    </div>
  );
}
