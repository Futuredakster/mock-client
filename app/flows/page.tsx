"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Flow = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Template = {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: string[];
  nodeCount: number;
  edgeCount: number;
};

export default function FlowsPage() {
  const { user, token, loading, serverUrl, authHeaders } = useAuth();
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const fetchFlows = useCallback(async () => {
    if (!token || !user) return;
    try {
      const res = await fetch(`${serverUrl}/api/flows?userId=${user.id}`);
      const data = await res.json();
      setFlows(Array.isArray(data) ? data : []);
    } catch {}
  }, [token, serverUrl, user]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/flows/templates`);
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {}
  }, [serverUrl]);

  useEffect(() => { fetchFlows(); fetchTemplates(); }, [fetchFlows, fetchTemplates]);

  const createFromTemplate = async (templateId: string) => {
    setCreatingTemplate(templateId);
    setError("");
    try {
      const res = await fetch(`${serverUrl}/api/flows/from-template`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user?.id, templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/flows/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create flow");
    } finally {
      setCreatingTemplate(null);
    }
  };

  const createFlow = async () => {
    if (!newName.trim()) {
      setError("Flow name is required");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`${serverUrl}/api/flows`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: user?.id,
          name: newName,
          description: newDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/flows/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create flow");
    } finally {
      setCreating(false);
    }
  };

  const deleteFlow = async (id: string) => {
    if (!confirm("Delete this flow? This cannot be undone.")) return;
    try {
      await fetch(`${serverUrl}/api/flows/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      fetchFlows();
    } catch {}
  };

  const toggleActive = async (flow: Flow) => {
    try {
      await fetch(`${serverUrl}/api/flows/${flow.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: !flow.is_active }),
      });
      fetchFlows();
    } catch {}
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
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🔀 Conversation Flows</h1>
            <p className="text-zinc-400 text-sm mt-1">Create and manage AI call scripts</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            {showCreate ? "Cancel" : "+ New Flow"}
          </button>
        </div>

        {/* Create form with template picker */}
        {showCreate && (
          <div className="space-y-4">
            {/* Template picker */}
            {templates.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="font-semibold">Start from a template</h3>
                  <p className="text-xs text-zinc-500 mt-1">Pre-built flows ready to use — just upload your data and call</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => createFromTemplate(t.id)}
                      disabled={creatingTemplate !== null}
                      className="text-left p-4 bg-zinc-800/50 border border-zinc-700/50 hover:border-indigo-600/50 hover:bg-zinc-800 rounded-xl transition-all cursor-pointer group disabled:opacity-50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{t.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm group-hover:text-indigo-400 transition-colors">
                            {creatingTemplate === t.id ? "Creating..." : t.name}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
                            <span>{t.nodeCount} steps</span>
                            <span>{t.edgeCount} branches</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {t.fields.map((f) => (
                              <span key={f} className="text-[10px] px-1.5 py-0.5 bg-indigo-900/20 text-indigo-400 rounded">({f})</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Blank flow */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm">Or start from scratch</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Flow name"
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                onKeyDown={(e) => e.key === "Enter" && createFlow()}
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={createFlow}
                  disabled={creating}
                  className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors cursor-pointer text-sm"
                >
                  {creating ? "Creating..." : "Create Blank Flow"}
                </button>
                {error && <span className="text-red-400 text-sm">{error}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Flows list */}
        {flows.length === 0 && !showCreate ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">🔀</div>
            <h3 className="text-lg font-semibold mb-2">No flows yet</h3>
            <p className="text-zinc-500 text-sm mb-4">
              Flows are conversation scripts that guide the AI during calls.
              <br />Pick a template or create one from scratch.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              + Create First Flow
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {flows.map((flow) => (
              <div key={flow.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/flows/${flow.id}`}
                        className="text-lg font-semibold hover:text-indigo-400 transition-colors"
                      >
                        {flow.name}
                      </Link>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                          flow.is_active
                            ? "bg-green-900/40 text-green-400 hover:bg-green-900/60"
                            : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                        }`}
                        onClick={() => toggleActive(flow)}
                        title={flow.is_active ? "Click to deactivate" : "Click to activate"}
                      >
                        {flow.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-1">{flow.description || "No description"}</p>
                    <p className="text-xs text-zinc-600 mt-2">
                      Created {new Date(flow.created_at).toLocaleDateString()}
                      {flow.updated_at !== flow.created_at && ` · Updated ${new Date(flow.updated_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      href={`/flows/${flow.id}`}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteFlow(flow.id)}
                      className="px-3 py-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
