"use client";

import { useState } from "react";
import Link from "next/link";

const MOCK_SERVER_URL = "https://aloxi-mock-server.azurewebsites.net";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) return setError("Please enter your email");
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${MOCK_SERVER_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
      if (data.resetUrl) setResetUrl(data.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="fixed inset-0 flex items-center justify-center p-6 z-50"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 600px 400px at 50% 40%, rgba(124,92,252,0.08), transparent)",
        }}
      />

      <div className="relative w-full max-w-[400px]">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: sent ? "rgba(52,211,153,0.12)" : "var(--accent-muted)" }}
          >
            {sent ? (
              <svg className="w-7 h-7" style={{ color: "var(--success)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            ) : (
              <svg className="w-7 h-7" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {sent ? "Check Your Email" : "Forgot Password?"}
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
            {sent
              ? "We've sent a password reset link to your email."
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl border p-6 space-y-5"
          style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
        >
          {sent ? (
            <>
              {/* Success state */}
              <div
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm"
                style={{ background: "rgba(52,211,153,0.1)", color: "var(--success)" }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Reset link sent to {email}
              </div>

              {/* Demo: show the reset link directly */}
              {resetUrl && (
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Demo mode — click the link below:
                  </p>
                  <Link
                    href={resetUrl.replace(/^https?:\/\/[^/]+/, '')}
                    className="block w-full py-2.5 text-sm font-semibold rounded-lg text-center text-white transition-all"
                    style={{ background: "var(--accent)", boxShadow: "0 2px 12px rgba(124,92,252,0.25)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                  >
                    Reset Password →
                  </Link>
                </div>
              )}

              <button
                onClick={() => { setSent(false); setResetUrl(null); setEmail(""); }}
                className="w-full py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
              >
                Send another link
              </button>
            </>
          ) : (
            <>
              {/* Email input */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-primary)")}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>

              {/* Error */}
              {error && (
                <div
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm"
                  style={{ background: "rgba(248,113,113,0.1)", color: "var(--danger)" }}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer text-white disabled:cursor-not-allowed"
                style={{
                  background: loading ? "var(--bg-hover)" : "var(--accent)",
                  boxShadow: loading ? "none" : "0 2px 12px rgba(124,92,252,0.25)",
                }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent-hover)"; }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent)"; }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--text-tertiary)", borderTopColor: "transparent" }} />
                    Sending…
                  </span>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </>
          )}
        </div>

        {/* Back to login */}
        <p className="text-center text-xs mt-6" style={{ color: "var(--text-tertiary)" }}>
          <Link
            href="/login"
            className="font-medium transition-colors inline-flex items-center gap-1"
            style={{ color: "var(--accent)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent)")}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
