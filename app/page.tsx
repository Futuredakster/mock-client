"use client";

import { useState } from "react";

const MOCK_SERVER_URL = "http://localhost:3005";

type CallResult = {
  success: boolean;
  callSid?: string;
  customer?: string;
  phone?: string;
  error?: string;
};

export default function Home() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);
  const [mode, setMode] = useState<"ai" | "tts">("ai");

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhone(e.target.value));
  };

  const getE164 = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    return digits.length === 10 ? `+1${digits}` : `+${digits}`;
  };

  const makeCall = async () => {
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 10) {
      setResult({ success: false, error: "Enter a valid 10-digit phone number" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      if (mode === "tts" && !message.trim()) {
        setResult({ success: false, error: "Enter a message for the call" });
        setLoading(false);
        return;
      }

      const res = await fetch(`${MOCK_SERVER_URL}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: getE164(phoneNumber),
          message: mode === "tts" ? message : "Hello, this is a test AI call.",
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to connect to mock server",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-4">📞</div>
          <h1 className="text-3xl font-bold tracking-tight">Mock Caller</h1>
          <p className="text-zinc-400 mt-2">
            Trigger an outbound call to any phone number
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-zinc-900 rounded-lg p-1">
          <button
            onClick={() => setMode("ai")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer ${
              mode === "ai"
                ? "bg-indigo-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            🤖 AI Call
          </button>
          <button
            onClick={() => setMode("tts")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer ${
              mode === "tts"
                ? "bg-indigo-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            🔊 TTS Call
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="(303) 555-1234"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg tracking-wide"
              maxLength={14}
            />
          </div>

          {mode === "tts" && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Message to Speak
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hello! This is a test call from the mock server."
                rows={3}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {mode === "ai" && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-400">
              <p className="font-medium text-zinc-300 mb-1">AI Mode</p>
              <p>
                The call will use Azure OpenAI Realtime to have an interactive
                AI conversation with the person who answers.
              </p>
            </div>
          )}

          <button
            onClick={makeCall}
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-lg cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Calling...
              </span>
            ) : (
              "Make Call"
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`p-4 rounded-lg border ${
              result.success
                ? "bg-green-900/30 border-green-700 text-green-300"
                : "bg-red-900/30 border-red-700 text-red-300"
            }`}
          >
            {result.success ? (
              <div className="space-y-1">
                <p className="font-semibold">✅ Call Initiated!</p>
                <p className="text-sm opacity-80">SID: {result.callSid}</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold">❌ Call Failed</p>
                <p className="text-sm opacity-80">{result.error}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600">
          Connects to mock server at {MOCK_SERVER_URL}
        </p>
      </div>
    </main>
  );
}
