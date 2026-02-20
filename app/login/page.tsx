"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, signup, user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    if (user) router.push("/");
  }, [user, router]);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Name is required");
        await signup(email, password, name);
      } else {
        await login(email, password);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-indigo-400">Aloxi</h1>
          <p className="text-zinc-400 mt-1 text-sm">AI-Powered Call Management</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-zinc-900 rounded-lg p-1">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer ${
              mode === "login" ? "bg-indigo-600 text-white shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer ${
              mode === "signup" ? "bg-indigo-600 text-white shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer"
          >
            {loading ? "..." : mode === "login" ? "Login" : "Create Account"}
          </button>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>

        <p className="text-center text-xs text-zinc-600">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            {mode === "login" ? "Sign up" : "Login"}
          </button>
        </p>
      </div>
    </main>
  );
}
