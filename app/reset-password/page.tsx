"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const MOCK_SERVER_URL = "https://aloxi-mock-server.azurewebsites.net";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    fetch(`${MOCK_SERVER_URL}/api/auth/validate-reset-token?token=${token}`)
      .then((r) => r.json())
      .then((data) => setTokenValid(data.valid))
      .catch(() => setTokenValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async () => {
    setError("");
    if (!password || !confirmPassword) return setError("Please fill in both fields");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirmPassword) return setError("Passwords don't match");

    setLoading(true);
    try {
      const res = await fetch(`${MOCK_SERVER_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Loading / validating state
  if (validating) {
    return (
      <div className="text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: "var(--accent-muted)" }}
        >
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Validating link…
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
          Please wait while we verify your reset link.
        </p>
      </div>
    );
  }

  // Invalid / missing token
  if (!token || !tokenValid) {
    return (
      <>
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "rgba(248,113,113,0.12)" }}
          >
            <svg className="w-7 h-7" style={{ color: "var(--danger)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Invalid Reset Link
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
            This link is invalid or has expired. Please request a new one.
          </p>
        </div>
        <div
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
        >
          <Link
            href="/forgot-password"
            className="block w-full py-2.5 text-sm font-semibold rounded-lg text-center text-white transition-all"
            style={{ background: "var(--accent)", boxShadow: "0 2px 12px rgba(124,92,252,0.25)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
          >
            Request New Link
          </Link>
        </div>
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
      </>
    );
  }

  // Success state
  if (success) {
    return (
      <>
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "rgba(52,211,153,0.12)" }}
          >
            <svg className="w-7 h-7" style={{ color: "var(--success)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Password Reset!
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
            Your password has been changed successfully.
          </p>
        </div>
        <div
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
        >
          <Link
            href="/login"
            className="block w-full py-2.5 text-sm font-semibold rounded-lg text-center text-white transition-all"
            style={{ background: "var(--accent)", boxShadow: "0 2px 12px rgba(124,92,252,0.25)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
          >
            Sign In with New Password
          </Link>
        </div>
      </>
    );
  }

  // Reset form
  return (
    <>
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: "var(--accent-muted)" }}
        >
          <svg className="w-7 h-7" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Set New Password
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
          Enter your new password below.
        </p>
      </div>

      <div
        className="rounded-xl border p-6 space-y-5"
        style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
      >
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
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
          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>Passwords don&apos;t match</p>
          )}
        </div>

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
              Resetting…
            </span>
          ) : (
            "Reset Password"
          )}
        </button>
      </div>

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
    </>
  );
}

export default function ResetPasswordPage() {
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
        <Suspense
          fallback={
            <div className="text-center">
              <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
              <p className="text-sm mt-3" style={{ color: "var(--text-tertiary)" }}>Loading…</p>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
