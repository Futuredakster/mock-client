"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

type Upload = {
  id: string;
  batch_id: string;
  phone_number: string;
  raw_data: Record<string, string>;
  status: string;
  call_sid: string | null;
  call_result: string | null;
  outcome: string | null;
  call_summary: string | null;
  call_data: Record<string, string> | null;
  call_duration: number | null;
  called_at: string | null;
  created_at: string;
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
};

export default function UploadsPage() {
  const { user, token, loading, serverUrl, authHeaders } = useAuth();
  const router = useRouter();

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState("");
  const [batchName, setBatchName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ insertedRows: number; skippedRows: number; batchId: string } | null>(null);
  const [uploadStep, setUploadStep] = useState<1 | 2>(1);

  // Batch list state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchRows, setBatchRows] = useState<Upload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [listSearch, setListSearch] = useState("");
  // Batch detail search + pagination
  const [detailSearch, setDetailSearch] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [detailTotal, setDetailTotal] = useState(0);
  const detailPageSize = 15;

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

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
    if (!token || !user) return;
    fetchBatches();
  }, [token, user, serverUrl, fetchBatches]);

  // Parse Excel file
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
      if (json.length === 0) return;
      const cols = Object.keys(json[0]);
      setHeaders(cols);
      setParsedRows(json);
      setUploadResult(null);
      const phoneCol = cols.find((c) =>
        c.toLowerCase().includes("phone") || c.toLowerCase().includes("mobile") ||
        c.toLowerCase().includes("cell") || c.toLowerCase().includes("number")
      );
      if (phoneCol) setPhoneColumn(phoneCol);
      setUploadStep(2);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Upload to server
  const handleUpload = async () => {
    if (!phoneColumn || parsedRows.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const rows = parsedRows.map((row) => {
        const phone = String(row[phoneColumn]).replace(/\D/g, "");
        const formatted = phone.length === 10 ? `+1${phone}` : phone.length === 11 && phone.startsWith("1") ? `+${phone}` : `+${phone}`;
        const { [phoneColumn]: _, ...rest } = row;
        return { phone_number: formatted, ...rest };
      });
      const res = await fetch(`${serverUrl}/api/uploads`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ rows, batchName: batchName.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadResult(data);
      setParsedRows([]);
      setHeaders([]);
      setPhoneColumn("");
      setBatchName("");
      setUploadStep(1);
      fetchBatches();
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadResult(null);
        router.push("/caller");
      }, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleBatch = async (batchId: string) => {
    if (expandedBatch === batchId) { setExpandedBatch(null); return; }
    setExpandedBatch(batchId);
    setDetailSearch("");
    setDetailPage(1);
    await fetchBatchDetail(batchId, "", 1);
  };

  const fetchBatchDetail = async (batchId: string, search: string, page: number) => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(detailPageSize) });
      if (search) params.set("search", search);
      const res = await fetch(`${serverUrl}/api/uploads/batch/${batchId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBatchRows(data.rows ?? data);
        setDetailTotal(data.filteredTotal ?? (Array.isArray(data) ? data.length : 0));
      }
    } catch {}
  };

  // Debounce detail search
  useEffect(() => {
    if (!expandedBatch) return;
    const timer = setTimeout(() => {
      setDetailPage(1);
      fetchBatchDetail(expandedBatch, detailSearch, 1);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailSearch]);

  useEffect(() => {
    if (!expandedBatch) return;
    fetchBatchDetail(expandedBatch, detailSearch, detailPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailPage]);

  const deleteBatch = async (batchId: string) => {
    if (!confirm("Delete this entire batch?")) return;
    try {
      await fetch(`${serverUrl}/api/uploads/batch/${batchId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBatches();
      if (expandedBatch === batchId) setExpandedBatch(null);
    } catch {}
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { bg: string; color: string; dot: string }> = {
      pending:   { bg: "rgba(251,191,36,0.12)", color: "var(--warning)", dot: "var(--warning)" },
      calling:   { bg: "rgba(96,165,250,0.12)", color: "var(--info)", dot: "var(--info)" },
      completed: { bg: "rgba(52,211,153,0.12)", color: "var(--success)", dot: "var(--success)" },
      failed:    { bg: "rgba(248,113,113,0.12)", color: "var(--danger)", dot: "var(--danger)" },
      skipped:   { bg: "rgba(92,100,120,0.12)", color: "var(--text-tertiary)", dot: "var(--text-tertiary)" },
    };
    const style = map[s] || map.skipped;
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium"
        style={{ background: style.bg, color: style.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
        {s}
      </span>
    );
  };

  const downloadTemplate = () => {
    const sampleData = [
      { firstname: "Jane", phone_number: "(303) 842-0715", product_name: "Widget Pro X", quantity: 5, olddate: "02/15/2026", newdate: "03/01/2026" },
      { firstname: "Robert", phone_number: "(720) 555-0142", product_name: "Turbo Blender 3000", quantity: 2, olddate: "02/10/2026", newdate: "02/28/2026" },
      { firstname: "Maria", phone_number: "(303) 555-0198", product_name: "Solar Panel Kit", quantity: 10, olddate: "01/20/2026", newdate: "02/20/2026" },
      { firstname: "David", phone_number: "(720) 555-0167", product_name: "Ergonomic Chair", quantity: 1, olddate: "02/01/2026", newdate: "02/22/2026" },
      { firstname: "Sarah", phone_number: "(303) 555-0134", product_name: "Wireless Headset", quantity: 3, olddate: "02/05/2026", newdate: "02/25/2026" },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Call List");
    XLSX.writeFile(wb, "call_list_template.xlsx");
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setParsedRows([]);
    setHeaders([]);
    setPhoneColumn("");
    setBatchName("");
    setUploadResult(null);
    setUploadStep(1);
  };

  const filteredBatches = batches.filter((b) => {
    if (!listSearch.trim()) return true;
    const q = listSearch.toLowerCase();
    return (
      (b.batch_name || "").toLowerCase().includes(q) ||
      (b.flow_name || "").toLowerCase().includes(q) ||
      new Date(b.uploaded_at).toLocaleDateString().includes(q)
    );
  });

  const detailTotalPages = Math.max(1, Math.ceil(detailTotal / detailPageSize));

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
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Contacts</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage your contacts and upload new data
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all cursor-pointer"
          style={{ background: "var(--accent)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          New Contact List
        </button>
      </div>

      {/* ── Search Toolbar ───────────────────────────────────── */}
      {batches.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.65 4.65a7.5 7.5 0 0012 12z" />
            </svg>
            <input
              type="text"
              placeholder="Search contacts..."
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none transition-all"
              style={{
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-primary)")}
            />
          </div>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {filteredBatches.length} list{filteredBatches.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── Batches Table ────────────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}>
        {batches.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3" style={{ background: "var(--accent-muted)" }}>
              <svg className="w-5 h-5" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>No contacts yet</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>Upload an Excel file to get started</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer"
              style={{ background: "var(--accent)" }}
            >
              Create Your First Contact List
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>List Name</th>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-tertiary)" }}>Contacts</th>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-tertiary)" }}>Assigned Flow</th>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-tertiary)" }}>Progress</th>
                <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-tertiary)" }}>Created</th>
                <th className="text-right px-5 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((b) => {
                const total = Number(b.total_rows);
                const done = Number(b.completed);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const isExpanded = expandedBatch === b.batch_id;

                return (
                  <tr key={b.batch_id}>
                    <td colSpan={6} className="p-0">
                      {/* Row */}
                      <div
                        className="flex items-center cursor-pointer transition-colors px-5 py-3.5"
                        style={{ borderBottom: isExpanded ? "none" : "1px solid var(--border-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => toggleBatch(b.batch_id)}
                      >
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {b.batch_name || "Untitled Upload"}
                          </div>
                        </div>
                        {/* Contact count */}
                        <div className="w-20 text-center hidden sm:block" style={{ color: "var(--text-secondary)" }}>{total}</div>
                        {/* Flow */}
                        <div className="w-36 hidden md:block truncate" style={{ color: b.flow_name ? "var(--text-secondary)" : "var(--text-tertiary)" }}>
                          {b.flow_name || "Unassigned"}
                        </div>
                        {/* Progress */}
                        <div className="w-28 hidden md:flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--bg-hover)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                          </div>
                          <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>{pct}%</span>
                        </div>
                        {/* Created */}
                        <div className="w-28 hidden lg:block text-xs" style={{ color: "var(--text-tertiary)" }}>
                          {new Date(b.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                        {/* Actions */}
                        <div className="w-20 flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteBatch(b.batch_id); }}
                            className="p-1.5 rounded-lg transition-colors cursor-pointer"
                            style={{ color: "var(--text-tertiary)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(248,113,113,0.1)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
                            title="Delete batch"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                          <svg className="w-4 h-4 transition-transform" style={{ color: "var(--text-tertiary)", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded detail view */}
                      {isExpanded && (
                        <div style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-primary)" }}>
                          {/* Stats row */}
                          <div className="px-5 py-3 flex items-center gap-4 text-xs flex-wrap" style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                            {Number(b.pending) > 0 && <span style={{ color: "var(--warning)" }}>⏳ {b.pending} pending</span>}
                            {Number(b.calling) > 0 && <span style={{ color: "var(--info)" }}>📞 {b.calling} calling</span>}
                            {Number(b.completed) > 0 && <span style={{ color: "var(--success)" }}>✅ {b.completed} completed</span>}
                            {Number(b.failed) > 0 && <span style={{ color: "var(--danger)" }}>❌ {b.failed} failed</span>}
                            {Number(b.no_answer) > 0 && <span style={{ color: "var(--warning)" }}>☎️ {b.no_answer} no answer</span>}
                            {Number(b.voicemail) > 0 && <span style={{ color: "var(--accent)" }}>📭 {b.voicemail} voicemail</span>}

                            {/* Search */}
                            <div className="ml-auto relative">
                              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.65 4.65a7.5 7.5 0 0012 12z" />
                              </svg>
                              <input
                                type="text"
                                placeholder="Search contacts..."
                                value={detailSearch}
                                onChange={(e) => setDetailSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 rounded-md text-xs focus:outline-none"
                                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", width: 200 }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>

                          {/* Contacts table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                                  <th className="text-left px-5 py-2.5 font-medium" style={{ color: "var(--text-tertiary)" }}>Phone</th>
                                  <th className="text-left px-5 py-2.5 font-medium" style={{ color: "var(--text-tertiary)" }}>Status</th>
                                  <th className="text-left px-5 py-2.5 font-medium" style={{ color: "var(--text-tertiary)" }}>Outcome</th>
                                  <th className="text-left px-5 py-2.5 font-medium" style={{ color: "var(--text-tertiary)" }}>Data</th>
                                  <th className="text-left px-5 py-2.5 font-medium" style={{ color: "var(--text-tertiary)" }}>Summary</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(Array.isArray(batchRows) ? batchRows : []).map((row) => (
                                  <tr key={row.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border-secondary)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                  >
                                    <td className="px-5 py-2.5 font-mono" style={{ color: "var(--accent)" }}>{row.phone_number}</td>
                                    <td className="px-5 py-2.5">{statusBadge(row.status)}</td>
                                    <td className="px-5 py-2.5">
                                      {row.outcome ? (
                                        <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{
                                          background: row.outcome.includes("change") ? "rgba(52,211,153,0.12)" : "rgba(92,100,120,0.12)",
                                          color: row.outcome.includes("change") ? "var(--success)" : "var(--text-secondary)"
                                        }}>{row.outcome}</span>
                                      ) : (
                                        <span style={{ color: "var(--text-tertiary)" }}>—</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-2.5 max-w-xs truncate" style={{ color: "var(--text-secondary)" }}>
                                      {Object.entries(row.raw_data).map(([k, v]) => `${k}: ${v}`).join(", ")}
                                    </td>
                                    <td className="px-5 py-2.5 max-w-xs">
                                      {row.call_summary ? (
                                        <span style={{ color: "var(--text-secondary)" }}>{row.call_summary}</span>
                                      ) : row.call_duration ? (
                                        <span style={{ color: "var(--text-tertiary)" }}>{row.call_duration}s call</span>
                                      ) : (
                                        <span style={{ color: "var(--text-tertiary)" }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination */}
                          {detailTotal > detailPageSize && (
                            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-secondary)" }}>
                              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                                {(detailPage - 1) * detailPageSize + 1}–{Math.min(detailPage * detailPageSize, detailTotal)} of {detailTotal}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDetailPage(p => Math.max(1, p - 1)); }}
                                  disabled={detailPage <= 1}
                                  className="px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer disabled:opacity-30"
                                  style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
                                >
                                  ← Prev
                                </button>
                                <span className="px-2 text-xs" style={{ color: "var(--text-tertiary)" }}>{detailPage}/{detailTotalPages}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDetailPage(p => Math.min(detailTotalPages, p + 1)); }}
                                  disabled={detailPage >= detailTotalPages}
                                  className="px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer disabled:opacity-30"
                                  style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
                                >
                                  Next →
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Download template link */}
      <div className="flex items-center gap-2 px-1">
        <button
          onClick={downloadTemplate}
          className="text-xs font-medium transition-colors cursor-pointer"
          style={{ color: "var(--accent)" }}
        >
          📥 Download sample template
        </button>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>— Pre-filled with mock data</span>
      </div>

      {/* ═══════════════════════════════════════════════════════
          UPLOAD MODAL
      ═══════════════════════════════════════════════════════ */}
      {showUploadModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={closeUploadModal} />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>New Contact List</h2>
              <button
                onClick={closeUploadModal}
                className="p-1 rounded-lg transition-colors cursor-pointer"
                style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stepper */}
            <div className="px-6 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-secondary)" }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: uploadStep >= 1 ? "var(--accent)" : "var(--bg-hover)",
                    color: uploadStep >= 1 ? "white" : "var(--text-tertiary)"
                  }}
                >1</div>
                <span className="text-sm font-medium" style={{ color: uploadStep >= 1 ? "var(--text-primary)" : "var(--text-tertiary)" }}>Upload File</span>
              </div>
              <div className="flex-1 h-px mx-2" style={{ background: uploadStep >= 2 ? "var(--accent)" : "var(--border-primary)" }} />
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: uploadStep >= 2 ? "var(--accent)" : "var(--bg-hover)",
                    color: uploadStep >= 2 ? "white" : "var(--text-tertiary)"
                  }}
                >2</div>
                <span className="text-sm font-medium" style={{ color: uploadStep >= 2 ? "var(--text-primary)" : "var(--text-tertiary)" }}>Details</span>
              </div>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              {uploadResult ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(52,211,153,0.15)" }}>
                    <svg className="w-7 h-7" style={{ color: "var(--success)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Upload Complete!</p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                    {uploadResult.insertedRows} contacts added{uploadResult.skippedRows > 0 && `, ${uploadResult.skippedRows} skipped`}
                  </p>
                  <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>Redirecting to Call Center…</p>
                </div>
              ) : uploadStep === 1 ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    className="border-2 border-dashed rounded-xl p-10 text-center transition-all"
                    style={{
                      borderColor: dragActive ? "var(--accent)" : "var(--border-primary)",
                      background: dragActive ? "var(--accent-muted)" : "transparent",
                    }}
                  >
                    <svg className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>Drag & drop your Excel file here, or</p>
                    <label
                      className="inline-block px-4 py-2 rounded-lg cursor-pointer text-sm font-medium text-white transition-all"
                      style={{ background: "var(--accent)" }}
                    >
                      Browse Files
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    </label>
                    <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>Supports .xlsx, .xls, .csv</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Batch name */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>List Name</label>
                    <input
                      type="text"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="e.g. February Refill Reminders"
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                      style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-primary)")}
                    />
                  </div>

                  {/* Phone column selector */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Phone Number Column</label>
                    <select
                      value={phoneColumn}
                      onChange={(e) => setPhoneColumn(e.target.value)}
                      className="px-3 py-2.5 rounded-lg text-sm focus:outline-none cursor-pointer"
                      style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    >
                      <option value="">-- Select --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Preview */}
                  <div>
                    <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Preview ({parsedRows.length} rows)
                    </p>
                    <div className="rounded-lg border overflow-x-auto max-h-48" style={{ borderColor: "var(--border-primary)" }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "var(--bg-hover)" }}>
                            <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-tertiary)" }}>#</th>
                            {headers.map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: h === phoneColumn ? "var(--accent)" : "var(--text-tertiary)" }}>
                                {h} {h === phoneColumn && "📞"}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.slice(0, 5).map((row, i) => (
                            <tr key={i} style={{ borderTop: "1px solid var(--border-secondary)" }}>
                              <td className="px-3 py-1.5" style={{ color: "var(--text-tertiary)" }}>{i + 1}</td>
                              {headers.map((h) => (
                                <td key={h} className="px-3 py-1.5" style={{ color: h === phoneColumn ? "var(--accent)" : "var(--text-secondary)" }}>
                                  {String(row[h])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {parsedRows.length > 5 && (
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>+ {parsedRows.length - 5} more rows</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            {!uploadResult && (
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-primary)" }}>
                <button
                  onClick={uploadStep === 2 ? () => { setUploadStep(1); setParsedRows([]); setHeaders([]); } : closeUploadModal}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                >
                  {uploadStep === 2 ? "← Back" : "Cancel"}
                </button>
                {uploadStep === 2 && (
                  <button
                    onClick={handleUpload}
                    disabled={!phoneColumn || uploading}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "var(--accent)" }}
                  >
                    {uploading ? "Creating..." : `Create Contact List (${parsedRows.length} contacts)`}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
