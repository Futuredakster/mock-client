"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

type CallResult = {
  success: boolean;
  callSid?: string;
  customer?: string;
  phone?: string;
  error?: string;
};

type Customer = {
  id: number;
  name: string;
  address: string;
  dateOfBirth: string;
  phone: string;
  lastOrder: {
    item: string;
    date: string;
    orderNumber: string;
  };
};

export default function CallerPage() {
  const { user, loading, serverUrl } = useAuth();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [callLoading, setCallLoading] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);
  const [mode, setMode] = useState<"ai" | "tts">("ai");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    fetch(`${serverUrl}/customers`)
      .then((res) => res.json())
      .then((data) => setCustomers(data))
      .catch(() => {});
  }, [serverUrl]);

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
    setCallLoading(true);
    setResult(null);
    try {
      if (mode === "tts" && !message.trim()) {
        setResult({ success: false, error: "Enter a message for the call" });
        setCallLoading(false);
        return;
      }
      const res = await fetch(`${serverUrl}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: getE164(phoneNumber),
          mode,
          ...(mode === "tts" ? { message } : {}),
          ...(mode === "ai" && selectedCustomer ? { customerId: selectedCustomer.id } : {}),
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : "Failed to connect" });
    } finally {
      setCallLoading(false);
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
      <div className="max-w-md mx-auto p-6 space-y-8 pt-12">
        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-4">📞</div>
          <h1 className="text-3xl font-bold tracking-tight">Quick Caller</h1>
          <p className="text-zinc-400 mt-2">Trigger an outbound call to any phone number</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-zinc-900 rounded-lg p-1">
          <button
            onClick={() => setMode("ai")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer ${
              mode === "ai" ? "bg-indigo-600 text-white shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            🤖 AI Call
          </button>
          <button
            onClick={() => setMode("tts")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer ${
              mode === "tts" ? "bg-indigo-600 text-white shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            🔊 TTS Call
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="(303) 555-1234"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg tracking-wide"
              maxLength={14}
            />
          </div>

          {mode === "tts" && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Message to Speak</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hello! This is a test call from the mock server."
                rows={3}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          )}

          {mode === "ai" && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-400">
              <p className="font-medium text-zinc-300 mb-1">AI Mode</p>
              <p>The call will use Azure OpenAI Realtime to have an interactive AI conversation.</p>
            </div>
          )}

          <button
            onClick={makeCall}
            disabled={callLoading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-lg cursor-pointer"
          >
            {callLoading ? (
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
          <div className={`p-4 rounded-lg border ${
            result.success ? "bg-green-900/30 border-green-700 text-green-300" : "bg-red-900/30 border-red-700 text-red-300"
          }`}>
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

        {/* Customers */}
        {customers.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-200">Mock Customers</h2>
            <p className="text-xs text-zinc-500">Click a customer to auto-fill their phone number.</p>
            <div className="space-y-2">
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomer(c);
                    const digits = c.phone.replace(/\D/g, "");
                    const local = digits.startsWith("1") ? digits.slice(1) : digits;
                    setPhoneNumber(`(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedCustomer?.id === c.id
                      ? "bg-indigo-900/30 border-indigo-600"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-200">{c.name}</span>
                    <span className="text-xs text-zinc-500">{c.phone}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 space-y-0.5">
                    <p>📍 {c.address}</p>
                    <p>🎂 DOB: {c.dateOfBirth}</p>
                    <p>📦 Last order: {c.lastOrder.item} ({c.lastOrder.date})</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
