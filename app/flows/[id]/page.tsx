"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type FlowNode = {
  id: string;
  label: string;
  ai_message: string;
  node_type: string;
  is_root: boolean;
  position_x: number;
  position_y: number;
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

type DefaultOption = {
  id: string;
  label: string;
  category: string;
};

export default function FlowDetailPage() {
  const { user, token, loading, serverUrl, authHeaders } = useAuth();
  const router = useRouter();
  const params = useParams();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<Flow | null>(null);
  const [defaultOptions, setDefaultOptions] = useState<DefaultOption[]>([]);

  // Editing flow info
  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Editing a node's AI message
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editMessage, setEditMessage] = useState("");

  // Adding a response branch
  const [addingResponseTo, setAddingResponseTo] = useState<string | null>(null);
  const [newCondition, setNewCondition] = useState("");
  const [newAiMessage, setNewAiMessage] = useState("");
  const [newNodeLabel, setNewNodeLabel] = useState("");

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

  useEffect(() => {
    fetchFlow();
    // Fetch default options for quick-pick response buttons
    fetch(`${serverUrl}/api/flows/options/defaults`)
      .then((r) => r.json())
      .then((data) => setDefaultOptions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [fetchFlow, serverUrl]);

  // Save flow name/description
  const saveFlowInfo = async () => {
    try {
      await fetch(`${serverUrl}/api/flows/${flowId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ name: editName, description: editDesc }),
      });
      setEditingInfo(false);
      fetchFlow();
    } catch {}
  };

  // Update a node's label + ai_message
  const saveNode = async (nodeId: string) => {
    try {
      await fetch(`${serverUrl}/api/flows/${flowId}/nodes/${nodeId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ label: editLabel, ai_message: editMessage }),
      });
      setEditingNodeId(null);
      fetchFlow();
    } catch {}
  };

  // Add a response branch: creates a new node + an edge from parentNodeId → new node
  const addResponseBranch = async (parentNodeId: string) => {
    if (!newCondition.trim() || !newAiMessage.trim()) return;
    try {
      // 1. Create the new child node
      const nodeRes = await fetch(`${serverUrl}/api/flows/${flowId}/nodes`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          label: newNodeLabel || newCondition,
          ai_message: newAiMessage,
          node_type: "question",
        }),
      });
      const newNode = await nodeRes.json();
      if (!nodeRes.ok) throw new Error(newNode.error);

      // 2. Create the edge from parent → new node
      await fetch(`${serverUrl}/api/flows/${flowId}/edges`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          from_node_id: parentNodeId,
          to_node_id: newNode.id,
          condition_value: newCondition,
          label: newCondition,
        }),
      });

      setAddingResponseTo(null);
      setNewCondition("");
      setNewAiMessage("");
      setNewNodeLabel("");
      fetchFlow();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add response");
    }
  };

  // Delete a node and its edges
  const deleteNode = async (nodeId: string) => {
    if (!confirm("Delete this node and all its branches?")) return;
    try {
      await fetch(`${serverUrl}/api/flows/${flowId}/nodes/${nodeId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      fetchFlow();
    } catch {}
  };

  // Delete an edge
  const deleteEdge = async (edgeId: string) => {
    try {
      await fetch(`${serverUrl}/api/flows/${flowId}/edges/${edgeId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      fetchFlow();
    } catch {}
  };

  // Get child edges from a node
  const getChildEdges = (nodeId: string) =>
    flow?.edges.filter((e) => e.from_node_id === nodeId) || [];

  // Get node by ID
  const getNode = (nodeId: string) =>
    flow?.nodes.find((n) => n.id === nodeId);

  // Recursive tree renderer
  const renderNode = (node: FlowNode, depth: number = 0) => {
    const childEdges = getChildEdges(node.id);
    const isEditing = editingNodeId === node.id;
    const isAddingResponse = addingResponseTo === node.id;

    const typeColors: Record<string, string> = {
      start: "border-l-green-500 bg-green-950/30",
      question: "border-l-blue-500 bg-blue-950/20",
      statement: "border-l-purple-500 bg-purple-950/20",
      end: "border-l-red-500 bg-red-950/20",
      transfer: "border-l-orange-500 bg-orange-950/20",
    };

    const typeIcons: Record<string, string> = {
      start: "🟢",
      question: "💬",
      statement: "📢",
      end: "🔴",
      transfer: "🔀",
    };

    return (
      <div key={node.id} className={`${depth > 0 ? "ml-6 md:ml-10" : ""}`}>
        {/* The node card */}
        <div className={`border-l-4 rounded-lg p-4 mb-3 border border-zinc-800 ${typeColors[node.node_type] || "border-l-zinc-500 bg-zinc-900"}`}>
          {isEditing ? (
            /* ---- EDIT MODE ---- */
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Label (short name)</label>
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">What should the AI say?</label>
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveNode(node.id)} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium cursor-pointer">Save</button>
                <button onClick={() => setEditingNodeId(null)} className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs cursor-pointer">Cancel</button>
              </div>
            </div>
          ) : (
            /* ---- VIEW MODE ---- */
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{typeIcons[node.node_type] || "📦"}</span>
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{node.label}</span>
                  {node.is_root && <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded">START</span>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingNodeId(node.id); setEditLabel(node.label); setEditMessage(node.ai_message); }}
                    className="px-2 py-1 hover:bg-zinc-700 rounded text-xs text-zinc-400 cursor-pointer"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  {!node.is_root && (
                    <button
                      onClick={() => deleteNode(node.id)}
                      className="px-2 py-1 hover:bg-red-900/30 rounded text-xs text-zinc-500 hover:text-red-400 cursor-pointer"
                      title="Delete"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>

              {/* AI message bubble */}
              <div className="mt-2 p-3 bg-zinc-800/60 rounded-lg border border-zinc-700/50">
                <p className="text-xs text-zinc-500 mb-1">🤖 AI says:</p>
                <p className="text-sm text-zinc-200 leading-relaxed">{node.ai_message}</p>
              </div>

              {/* Response count & add button */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  {childEdges.length === 0
                    ? "No customer responses defined"
                    : `${childEdges.length} response${childEdges.length > 1 ? "s" : ""} defined`}
                </span>
                <button
                  onClick={() => {
                    setAddingResponseTo(isAddingResponse ? null : node.id);
                    setNewCondition("");
                    setNewAiMessage("");
                    setNewNodeLabel("");
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  {isAddingResponse ? "Cancel" : "+ Add Response"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add response form */}
        {isAddingResponse && (
          <div className="ml-6 md:ml-10 mb-3">
            <div className="bg-zinc-900 border border-dashed border-indigo-600/50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-indigo-400">When the customer says...</p>

              {/* Quick pick from defaults */}
              <div className="flex flex-wrap gap-1">
                {defaultOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setNewCondition(opt.label)}
                    className={`px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                      newCondition === opt.label
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Or type a custom response</label>
                <input
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  placeholder='e.g. "Yes", "No", "Tell me more"'
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Then the AI should say...</label>
                <textarea
                  value={newAiMessage}
                  onChange={(e) => setNewAiMessage(e.target.value)}
                  placeholder="What the AI responds with when the customer says this"
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Node label (optional, for your reference)</label>
                <input
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  placeholder={newCondition ? `Response to "${newCondition}"` : "e.g. Handle Yes"}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => addResponseBranch(node.id)}
                disabled={!newCondition.trim() || !newAiMessage.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
              >
                Add This Branch
              </button>
            </div>
          </div>
        )}

        {/* Child branches */}
        {childEdges.length > 0 && (
          <div className={`${depth > 0 ? "" : "ml-6 md:ml-10"} space-y-1 mb-4`}>
            {childEdges.map((edge) => {
              const childNode = getNode(edge.to_node_id);
              if (!childNode) return null;
              return (
                <div key={edge.id}>
                  {/* Edge label (customer response) */}
                  <div className="flex items-center gap-2 mb-1 ml-2">
                    <div className="w-4 border-t border-zinc-700" />
                    <span className="text-xs font-medium px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-full text-yellow-300">
                      Customer: &quot;{edge.condition_value}&quot;
                    </span>
                    <button
                      onClick={() => deleteEdge(edge.id)}
                      className="text-[10px] text-zinc-600 hover:text-red-400 cursor-pointer"
                      title="Remove this branch"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Recursively render child node */}
                  {renderNode(childNode, depth + 1)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-500">Loading...</p>
      </main>
    );
  }

  if (!flow) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-500">Loading flow...</p>
      </main>
    );
  }

  const rootNode = flow.nodes.find((n) => n.is_root);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/flows" className="hover:text-zinc-300">Flows</Link>
          <span>›</span>
          <span className="text-zinc-300">{flow.name}</span>
        </div>

        {/* Flow header */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          {editingInfo ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
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
                  <span className={flow.is_active ? "text-green-400" : "text-zinc-500"}>
                    {flow.is_active ? "● Active" : "○ Inactive"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingInfo(true)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs cursor-pointer"
              >
                ✏️ Edit Info
              </button>
            </div>
          )}
        </div>

        {/* How it works hint */}
        <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-lg p-4 text-sm text-indigo-300/80">
          <p className="font-medium text-indigo-300 mb-1">💡 How to build your flow</p>
          <p>
            Start from the <strong>Greeting</strong> — this is what the AI says first. Then add <strong>responses</strong> for what the customer might say
            (e.g. &quot;Yes&quot;, &quot;No&quot;). For each response, define what the AI should say next. Keep branching to build the full conversation tree.
          </p>
        </div>

        {/* Conversation Tree */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Conversation Tree</h2>
          {rootNode ? (
            renderNode(rootNode)
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500">No root node found. This flow may be corrupted.</p>
            </div>
          )}

          {/* Orphaned nodes (not connected to tree) */}
          {(() => {
            const connectedIds = new Set<string>();
            if (rootNode) {
              const queue = [rootNode.id];
              while (queue.length > 0) {
                const id = queue.shift()!;
                connectedIds.add(id);
                flow.edges
                  .filter((e) => e.from_node_id === id)
                  .forEach((e) => {
                    if (!connectedIds.has(e.to_node_id)) queue.push(e.to_node_id);
                  });
              }
            }
            const orphans = flow.nodes.filter((n) => !connectedIds.has(n.id));
            if (orphans.length === 0) return null;
            return (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-400">⚠️ Disconnected Nodes ({orphans.length})</h3>
                <p className="text-xs text-zinc-500">These nodes aren&apos;t connected to the conversation tree.</p>
                {orphans.map((node) => (
                  <div key={node.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{node.label}</span>
                      <p className="text-xs text-zinc-500 mt-0.5">{node.ai_message?.slice(0, 80)}...</p>
                    </div>
                    <button
                      onClick={() => deleteNode(node.id)}
                      className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer px-2 py-1"
                    >
                      🗑 Delete
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </main>
  );
}
