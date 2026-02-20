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
  skipped: string;
  uploaded_by_name: string;
  flow_name: string | null;
  flow_id: string | null;
};

type Flow = {
  id: string;
  name: string;
};

export default function UploadsPage() {
  const { user, token, loading, serverUrl, authHeaders } = useAuth();
  const router = useRouter();

  // Upload state
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState("");
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [flows, setFlows] = useState<Flow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ insertedRows: number; skippedRows: number; batchId: string } | null>(null);

  // Batch list state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchRows, setBatchRows] = useState<Upload[]>([]);
  const [dragActive, setDragActive] = useState(false);

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
    fetch(`${serverUrl}/api/flows?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => setFlows(Array.isArray(data) ? data : []))
      .catch(() => {});
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
        body: JSON.stringify({ flowId: selectedFlowId || undefined, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadResult(data);
      setParsedRows([]);
      setHeaders([]);
      setPhoneColumn("");
      fetchBatches();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleBatch = async (batchId: string) => {
    if (expandedBatch === batchId) { setExpandedBatch(null); return; }
    setExpandedBatch(batchId);
    try {
      const res = await fetch(`${serverUrl}/api/uploads/batch/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBatchRows(await res.json());
    } catch {}
  };

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

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-yellow-900/40 text-yellow-300 border-yellow-700";
      case "calling": return "bg-blue-900/40 text-blue-300 border-blue-700";
      case "completed": return "bg-green-900/40 text-green-300 border-green-700";
      case "failed": return "bg-red-900/40 text-red-300 border-red-700";
      case "skipped": return "bg-zinc-800 text-zinc-400 border-zinc-700";
      default: return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">📋 Upload Manager</h1>
          <p className="text-zinc-400 text-sm mt-1">Upload Excel files to create call lists</p>
        </div>

        {/* Upload Zone */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Upload Excel File</h2>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? "border-indigo-500 bg-indigo-900/20" : "border-zinc-700 hover:border-zinc-500"
            }`}
          >
            <p className="text-zinc-400 mb-2">Drag & drop an Excel file here, or</p>
            <label className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer text-sm font-medium transition-colors">
              Browse Files
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
            <p className="text-zinc-600 text-xs mt-2">Supports .xlsx, .xls, .csv</p>
          </div>

          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Phone Number Column</label>
                  <select value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">-- Select --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Assign Flow (optional)</label>
                  <select value={selectedFlowId} onChange={(e) => setSelectedFlowId(e.target.value)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">-- No Flow --</option>
                    {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="ml-auto text-sm text-zinc-400">{parsedRows.length} rows parsed</div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="text-left px-3 py-2 text-zinc-400 font-medium">#</th>
                      {headers.map((h) => (
                        <th key={h} className={`text-left px-3 py-2 font-medium ${h === phoneColumn ? "text-indigo-400" : "text-zinc-400"}`}>
                          {h} {h === phoneColumn && "📞"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                        <td className="px-3 py-2 text-zinc-500">{i + 1}</td>
                        {headers.map((h) => (
                          <td key={h} className={`px-3 py-2 ${h === phoneColumn ? "text-indigo-300 font-medium" : "text-zinc-300"}`}>
                            {String(row[h])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 10 && (
                  <div className="px-3 py-2 text-xs text-zinc-500 bg-zinc-800/50">... and {parsedRows.length - 10} more rows</div>
                )}
              </div>

              <button onClick={handleUpload} disabled={!phoneColumn || uploading}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer">
                {uploading ? "Uploading..." : `Upload ${parsedRows.length} Rows`}
              </button>
            </div>
          )}

          {uploadResult && (
            <div className="p-4 rounded-lg bg-green-900/30 border border-green-700 text-green-300">
              <p className="font-semibold">✅ Upload Complete!</p>
              <p className="text-sm mt-1">
                {uploadResult.insertedRows} rows inserted
                {uploadResult.skippedRows > 0 && `, ${uploadResult.skippedRows} skipped (no phone)`}
              </p>
              <p className="text-xs text-green-400/70 mt-1">Batch ID: {uploadResult.batchId}</p>
            </div>
          )}
        </div>

        {/* Batches List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Upload History</h2>
          {batches.length === 0 ? (
            <p className="text-zinc-500 text-sm">No uploads yet. Upload an Excel file above to get started.</p>
          ) : (
            <div className="space-y-3">
              {batches.map((b) => (
                <div key={b.batch_id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors" onClick={() => toggleBatch(b.batch_id)}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{b.flow_name || "No flow assigned"}</span>
                        <span className="text-xs text-zinc-500">
                          {new Date(b.uploaded_at).toLocaleDateString()} {new Date(b.uploaded_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-400">{b.total_rows} rows</span>
                        {Number(b.pending) > 0 && <span className="text-yellow-400">⏳ {b.pending}</span>}
                        {Number(b.calling) > 0 && <span className="text-blue-400">📞 {b.calling}</span>}
                        {Number(b.completed) > 0 && <span className="text-green-400">✅ {b.completed}</span>}
                        {Number(b.failed) > 0 && <span className="text-red-400">❌ {b.failed}</span>}
                        {Number(b.skipped) > 0 && <span className="text-zinc-500">⏭ {b.skipped}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); deleteBatch(b.batch_id); }}
                        className="text-xs text-zinc-500 hover:text-red-400 px-2 py-1 cursor-pointer">🗑 Delete</button>
                      <span className="text-zinc-500 text-sm">{expandedBatch === b.batch_id ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {expandedBatch === b.batch_id && (
                    <div className="border-t border-zinc-800 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-800">
                          <tr>
                            <th className="text-left px-3 py-2 text-zinc-400 font-medium">Phone</th>
                            <th className="text-left px-3 py-2 text-zinc-400 font-medium">Status</th>
                            <th className="text-left px-3 py-2 text-zinc-400 font-medium">Data</th>
                            <th className="text-left px-3 py-2 text-zinc-400 font-medium">Call SID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchRows.map((row) => (
                            <tr key={row.id} className="border-t border-zinc-800/50">
                              <td className="px-3 py-2 text-indigo-300 font-mono text-xs">{row.phone_number}</td>
                              <td className="px-3 py-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(row.status)}`}>{row.status}</span>
                              </td>
                              <td className="px-3 py-2 text-zinc-400 text-xs max-w-xs truncate">
                                {Object.entries(row.raw_data).map(([k, v]) => `${k}: ${v}`).join(", ")}
                              </td>
                              <td className="px-3 py-2 text-zinc-500 text-xs font-mono">{row.call_sid || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
