"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────

type FlowNode = {
  id: string;
  label: string;
  ai_message: string;
  node_type: string;
  is_root: boolean;
  position_x: number;
  position_y: number;
  outcome: string | null;
  capture_field: string | null;
};

type FlowEdge = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  condition_value: string;
  label: string;
};

type Flow = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

type PreviewMsg = { role: "ai" | "customer"; text: string };

// ─── Main Page ──────────────────────────────────────────────────

export default function FlowDetailPage() {
  const { user, token, loading, serverUrl, authHeaders } = useAuth();
  const router = useRouter();
  const params = useParams();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<Flow | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Record<string, number>>({});

  // Editing
  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editOutcome, setEditOutcome] = useState("");
  const [editCaptureField, setEditCaptureField] = useState("");

  // Adding a response
  const [addingResponseTo, setAddingResponseTo] = useState<string | null>(null);
  const [newCondition, setNewCondition] = useState("");
  const [newAiMessage, setNewAiMessage] = useState("");
  const [endsConversation, setEndsConversation] = useState(false);
  const [transferToHuman, setTransferToHuman] = useState(false);
  const [captureAnswer, setCaptureAnswer] = useState(false);
  const [newOutcome, setNewOutcome] = useState("");
  const [newCaptureField, setNewCaptureField] = useState("");

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<PreviewMsg[]>([]);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const fetchFlow = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${serverUrl}/api/flows/${flowId}`);
      if (res.ok) {
        const data = await res.json();
        setFlow(data);
        setEditName(data.name);
        setEditDesc(data.description || "");
      }
    } catch {}
  }, [token, serverUrl, flowId]);

  useEffect(() => { fetchFlow(); }, [fetchFlow]);

  // ─── Helpers ──────────────────────────────────────────────────

  const getChildEdges = (nodeId: string) => flow?.edges.filter((e) => e.from_node_id === nodeId) || [];
  const getNode = (nodeId: string) => flow?.nodes.find((n) => n.id === nodeId);
  const typeIcon = (t: string) => ({ start: "🟢", question: "💬", statement: "📢", end: "🔴", transfer: "🔀", capture: "📝" }[t] || "📦");
  const typeColor = (t: string) => ({
    start: "border-green-500/60 bg-green-950/20",
    question: "border-blue-500/60 bg-blue-950/15",
    end: "border-red-500/60 bg-red-950/15",
    transfer: "border-orange-500/60 bg-orange-950/15",
    capture: "border-cyan-500/60 bg-cyan-950/15",
    statement: "border-purple-500/60 bg-purple-950/15",
  }[t] || "border-zinc-600 bg-zinc-900");

  const detectNodeType = () => {
    if (transferToHuman) return "transfer";
    if (endsConversation) return "end";
    if (captureAnswer) return "capture";
    return "question";
  };

  // ─── Actions ──────────────────────────────────────────────────

  const saveFlowInfo = async () => {
    try {
      await fetch(`${serverUrl}/api/flows/${flowId}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ name: editName, description: editDesc }) });
      setEditingInfo(false);
      fetchFlow();
    } catch {}
  };

  const saveNode = async (nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    try {
      await fetch(`${serverUrl}/api/flows/${flowId}/nodes/${nodeId}`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify({ label: editLabel, ai_message: editMessage, node_type: node.node_type, outcome: editOutcome || null, capture_field: editCaptureField || null }),
      });
      setEditingNodeId(null);
      fetchFlow();
    } catch {}
  };

  const addResponseBranch = async (parentNodeId: string) => {
    if (!newCondition.trim() || !newAiMessage.trim()) return;
    const nodeType = detectNodeType();
    try {
      const nodeRes = await fetch(`${serverUrl}/api/flows/${flowId}/nodes`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          label: newCondition.slice(0, 30), ai_message: newAiMessage, node_type: nodeType,
          outcome: (nodeType === "end" || nodeType === "transfer") ? (newOutcome || null) : null,
          capture_field: nodeType === "capture" ? (newCaptureField || null) : null,
        }),
      });
      const newNode = await nodeRes.json();
      if (!nodeRes.ok) throw new Error(newNode.error);
      await fetch(`${serverUrl}/api/flows/${flowId}/edges`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ from_node_id: parentNodeId, to_node_id: newNode.id, condition_value: newCondition, label: newCondition }),
      });
      resetAddForm();
      fetchFlow();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add response");
    }
  };

  const resetAddForm = () => {
    setAddingResponseTo(null); setNewCondition(""); setNewAiMessage("");
    setEndsConversation(false); setTransferToHuman(false); setCaptureAnswer(false);
    setNewOutcome(""); setNewCaptureField("");
  };

  const deleteNode = async (nodeId: string) => {
    if (!confirm("Delete this step and all its branches?")) return;
    try { await fetch(`${serverUrl}/api/flows/${flowId}/nodes/${nodeId}`, { method: "DELETE", headers: authHeaders() }); fetchFlow(); } catch {}
  };

  const deleteEdge = async (edgeId: string) => {
    if (!confirm("Remove this response branch?")) return;
    try { await fetch(`${serverUrl}/api/flows/${flowId}/edges/${edgeId}`, { method: "DELETE", headers: authHeaders() }); fetchFlow(); } catch {}
  };

  const selectPath = (nodeId: string, idx: number) => setSelectedPaths((prev) => ({ ...prev, [nodeId]: idx }));

  // ─── Preview ──────────────────────────────────────────────────

  const startPreview = () => {
    const root = flow?.nodes.find((n) => n.is_root);
    if (!root) return;
    setPreviewMessages([{ role: "ai", text: root.ai_message }]);
    setPreviewNodeId(root.id);
    setShowPreview(true);
  };

  const advancePreview = (edge: FlowEdge) => {
    const child = getNode(edge.to_node_id);
    if (!child) return;
    setPreviewMessages((prev) => [...prev, { role: "customer", text: edge.condition_value }, { role: "ai", text: child.ai_message }]);
    setPreviewNodeId(child.id);
  };

  const resetPreview = () => {
    const root = flow?.nodes.find((n) => n.is_root);
    if (!root) return;
    setPreviewMessages([{ role: "ai", text: root.ai_message }]);
    setPreviewNodeId(root.id);
  };

  const previewOptions = previewNodeId ? getChildEdges(previewNodeId) : [];
  const previewCurrentNode = previewNodeId ? getNode(previewNodeId) : null;

  // ─── Flow Map Renderer ───────────────────────────────────────

  const renderFlowNode = (node: FlowNode, isFirst = false): React.ReactNode => {
    const childEdges = getChildEdges(node.id);
    const selectedIdx = selectedPaths[node.id] ?? 0;
    const selectedEdge = childEdges[selectedIdx];
    const selectedChild = selectedEdge ? getNode(selectedEdge.to_node_id) : null;
    const isEditing = editingNodeId === node.id;
    const isAddingHere = addingResponseTo === node.id;
    const isTerminal = node.node_type === "end" || node.node_type === "transfer";

    return (
      <div className="flex flex-col items-center w-full" key={node.id}>
        {!isFirst && <div className="w-px h-8 bg-gradient-to-b from-zinc-700 to-zinc-600" />}

        {/* Node Card */}
        <div className={`w-full max-w-2xl border-l-4 rounded-xl border border-zinc-800 ${typeColor(node.node_type)} transition-all`}>
          {isEditing ? (
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Step label</label>
                <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">What should the AI say?</label>
                <textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={3} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                <p className="text-[11px] text-zinc-600 mt-1">Use (field name) for dynamic data, e.g. (patient name), (medication)</p>
              </div>
              {(node.node_type === "end" || node.node_type === "transfer") && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Outcome tag</label>
                  <input value={editOutcome} onChange={(e) => setEditOutcome(e.target.value)} placeholder="e.g. confirmed, cancelled" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
              {node.node_type === "capture" && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">What field to capture?</label>
                  <input value={editCaptureField} onChange={(e) => setEditCaptureField(e.target.value)} placeholder="e.g. preferred_date" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => saveNode(node.id)} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium cursor-pointer">Save</button>
                <button onClick={() => setEditingNodeId(null)} className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs cursor-pointer">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg flex-shrink-0">{typeIcon(node.node_type)}</span>
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide truncate">{node.label}</span>
                  {node.is_root && <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded flex-shrink-0">START</span>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditingNodeId(node.id); setEditLabel(node.label); setEditMessage(node.ai_message); setEditOutcome(node.outcome || ""); setEditCaptureField(node.capture_field || ""); }} className="p-1.5 hover:bg-zinc-700/50 rounded text-zinc-500 hover:text-zinc-300 cursor-pointer" title="Edit">✏️</button>
                  {!node.is_root && <button onClick={() => deleteNode(node.id)} className="p-1.5 hover:bg-red-900/30 rounded text-zinc-600 hover:text-red-400 cursor-pointer" title="Delete">🗑</button>}
                </div>
              </div>
              <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/40">
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{highlightPlaceholders(node.ai_message)}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {node.outcome && <span className="text-[10px] px-2 py-0.5 bg-red-900/30 text-red-300 rounded border border-red-800/40">🏷 {node.outcome}</span>}
                {node.capture_field && <span className="text-[10px] px-2 py-0.5 bg-cyan-900/30 text-cyan-300 rounded border border-cyan-800/40">📝 captures: {node.capture_field}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Response Tabs */}
        {childEdges.length > 0 && (
          <>
            <div className="w-px h-6 bg-zinc-700" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Customer responds</div>
            <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-2xl">
              {childEdges.map((edge, idx) => (
                <div key={edge.id} className="flex items-center gap-1">
                  <button onClick={() => selectPath(node.id, idx)} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${selectedIdx === idx ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700"}`}>
                    &ldquo;{edge.condition_value}&rdquo;
                  </button>
                  <button onClick={() => deleteEdge(edge.id)} className="text-zinc-700 hover:text-red-400 cursor-pointer text-[10px]" title="Remove">✕</button>
                </div>
              ))}
              {!isTerminal && (
                <button onClick={() => { resetAddForm(); setAddingResponseTo(isAddingHere ? null : node.id); }} className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-indigo-600/50 text-indigo-400 hover:bg-indigo-950/30 cursor-pointer transition-colors">+ Add</button>
              )}
            </div>
            {isAddingHere && renderAddForm(node.id)}
            {selectedChild && renderFlowNode(selectedChild)}
          </>
        )}

        {/* No responses yet */}
        {childEdges.length === 0 && !isTerminal && (
          <>
            <div className="w-px h-6 bg-zinc-700" />
            {isAddingHere ? renderAddForm(node.id) : (
              <button onClick={() => { resetAddForm(); setAddingResponseTo(node.id); }} className="px-4 py-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500 hover:text-indigo-400 hover:border-indigo-600/50 cursor-pointer transition-all">+ Add customer response</button>
            )}
          </>
        )}

        {/* Terminal badge */}
        {isTerminal && childEdges.length === 0 && (
          <>
            <div className="w-px h-4 bg-zinc-700" />
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${node.node_type === "end" ? "bg-red-900/30 text-red-400 border border-red-800/40" : "bg-orange-900/30 text-orange-400 border border-orange-800/40"}`}>
              {node.node_type === "end" ? "🔴 Conversation ends" : "🔀 Transfer to human"}
            </div>
          </>
        )}
      </div>
    );
  };

  // ─── Add Branch Form ──────────────────────────────────────────

  const renderAddForm = (parentNodeId: string) => (
    <div className="w-full max-w-2xl mt-2 mb-2">
      <div className="bg-zinc-900 border border-dashed border-indigo-600/40 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-indigo-400">➕ Add a response branch</p>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">When the customer says...</label>
          <input value={newCondition} onChange={(e) => setNewCondition(e.target.value)} placeholder={'"Yes", "No", "I need to reschedule"'} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Then the AI should say...</label>
          <textarea value={newAiMessage} onChange={(e) => setNewAiMessage(e.target.value)} placeholder="What the AI responds with" rows={3} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <p className="text-[11px] text-zinc-600 mt-1">Use (field name) for dynamic data from uploads</p>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={endsConversation} onChange={(e) => { setEndsConversation(e.target.checked); if (e.target.checked) setTransferToHuman(false); }} className="rounded border-zinc-600 bg-zinc-800" />
            <span className="text-xs text-zinc-400 group-hover:text-zinc-300">🔴 This ends the conversation</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={transferToHuman} onChange={(e) => { setTransferToHuman(e.target.checked); if (e.target.checked) setEndsConversation(false); }} className="rounded border-zinc-600 bg-zinc-800" />
            <span className="text-xs text-zinc-400 group-hover:text-zinc-300">🔀 Transfer to a real person</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={captureAnswer} onChange={(e) => setCaptureAnswer(e.target.checked)} className="rounded border-zinc-600 bg-zinc-800" />
            <span className="text-xs text-zinc-400 group-hover:text-zinc-300">📝 Record customer&apos;s answer</span>
          </label>
        </div>
        {(endsConversation || transferToHuman) && (
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Outcome tag (for tracking)</label>
            <input value={newOutcome} onChange={(e) => setNewOutcome(e.target.value)} placeholder="e.g. confirmed, cancelled" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        )}
        {captureAnswer && (
          <div>
            <label className="text-xs text-zinc-400 block mb-1">What field to capture?</label>
            <input value={newCaptureField} onChange={(e) => setNewCaptureField(e.target.value)} placeholder="e.g. preferred_date, medication" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={() => addResponseBranch(parentNodeId)} disabled={!newCondition.trim() || !newAiMessage.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors">Add Branch</button>
          <button onClick={resetAddForm} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm cursor-pointer text-zinc-400">Cancel</button>
        </div>
      </div>
    </div>
  );

  // ─── Page Render ──────────────────────────────────────────────

  if (loading || !user) return <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white"><p className="text-zinc-500">Loading...</p></main>;
  if (!flow) return <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white"><p className="text-zinc-500">Loading flow...</p></main>;

  const rootNode = flow.nodes.find((n) => n.is_root);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/flows" className="hover:text-zinc-300 transition-colors">← Flows</Link>
            <span>›</span>
            <span className="text-zinc-300">{flow.name}</span>
          </div>
          <button onClick={startPreview} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium cursor-pointer transition-colors flex items-center gap-2">
            💬 Preview Conversation
          </button>
        </div>

        {/* Flow Info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          {editingInfo ? (
            <div className="space-y-3">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" rows={2} className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <div className="flex gap-2">
                <button onClick={saveFlowInfo} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm cursor-pointer">Save</button>
                <button onClick={() => setEditingInfo(false)} className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm cursor-pointer">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{flow.name}</h1>
                <p className="text-sm text-zinc-400 mt-1">{flow.description || "No description"}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                  <span>{flow.nodes.length} steps</span>
                  <span>{flow.edges.length} branches</span>
                  <span className={flow.is_active ? "text-green-400" : "text-zinc-500"}>{flow.is_active ? "● Active" : "○ Inactive"}</span>
                </div>
              </div>
              <button onClick={() => setEditingInfo(true)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs cursor-pointer">✏️ Edit Info</button>
            </div>
          )}
        </div>

        {/* Flow Map */}
        <div className="flex flex-col items-center py-4">
          {rootNode ? renderFlowNode(rootNode, true) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center w-full max-w-2xl">
              <p className="text-zinc-500">No root node found.</p>
            </div>
          )}
        </div>

        {/* Orphaned nodes */}
        {(() => {
          const connected = new Set<string>();
          if (rootNode) {
            const q = [rootNode.id];
            while (q.length > 0) {
              const id = q.shift()!;
              connected.add(id);
              flow.edges.filter((e) => e.from_node_id === id).forEach((e) => { if (!connected.has(e.to_node_id)) q.push(e.to_node_id); });
            }
          }
          const orphans = flow.nodes.filter((n) => !connected.has(n.id));
          if (orphans.length === 0) return null;
          return (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-semibold text-amber-400">⚠️ Disconnected Steps ({orphans.length})</h3>
              {orphans.map((n) => (
                <div key={n.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                  <div><span className="text-sm font-medium">{n.label}</span><p className="text-xs text-zinc-500 mt-0.5 truncate max-w-md">{n.ai_message}</p></div>
                  <button onClick={() => deleteNode(n.id)} className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer px-2 py-1">🗑</button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Conversation Preview Panel */}
      {showPreview && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowPreview(false)} />
          <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold">💬 Conversation Preview</h3>
              <button onClick={() => setShowPreview(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {previewMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "ai" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${msg.role === "ai" ? "bg-zinc-800 text-zinc-200 rounded-bl-md" : "bg-indigo-600 text-white rounded-br-md"}`}>
                    <p className="text-[10px] font-medium mb-1 opacity-60">{msg.role === "ai" ? "🤖 AI Agent" : "👤 Customer"}</p>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
              {previewCurrentNode && (previewCurrentNode.node_type === "end" || previewCurrentNode.node_type === "transfer") && (
                <div className="text-center py-3">
                  <span className={`text-xs px-3 py-1 rounded-full ${previewCurrentNode.node_type === "end" ? "bg-red-900/30 text-red-400 border border-red-800/40" : "bg-orange-900/30 text-orange-400 border border-orange-800/40"}`}>
                    {previewCurrentNode.node_type === "end" ? "🔴 Call ended" : "🔀 Transferred"}{previewCurrentNode.outcome && ` · ${previewCurrentNode.outcome}`}
                  </span>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-zinc-800">
              {previewOptions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Choose a response:</p>
                  {previewOptions.map((edge) => (
                    <button key={edge.id} onClick={() => advancePreview(edge)} className="w-full text-left px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-indigo-600/50 rounded-xl text-sm cursor-pointer transition-all">
                      &ldquo;{edge.condition_value}&rdquo;
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 text-center">
                  {previewCurrentNode && (previewCurrentNode.node_type === "end" || previewCurrentNode.node_type === "transfer") ? "Conversation complete" : "No responses defined"}
                </p>
              )}
              <button onClick={resetPreview} className="w-full mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-400 cursor-pointer">↺ Start Over</button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

// ─── Highlight Placeholders ─────────────────────────────────────

function highlightPlaceholders(text: string) {
  const parts = text.split(/([\[\(\{][^\]\)\}]+[\]\)\}])/g);
  return parts.map((part, i) => {
    if (/^[\[\(\{]/.test(part) && /[\]\)\}]$/.test(part)) {
      return <span key={i} className="text-indigo-400 font-medium bg-indigo-900/20 px-0.5 rounded">{part}</span>;
    }
    return part;
  });
}
