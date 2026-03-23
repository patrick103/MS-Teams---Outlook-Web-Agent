"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      window.location.href = "/api/auth";
    } catch {
      setError("Failed to start authentication");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            MS Teams & Outlook
            <span className="block text-indigo-400">AI Agent</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-sm max-w-sm mx-auto">
            Connect your Microsoft account and let AI monitor, respond, summarize, and manage your communications on your behalf.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 21 21" fill="currentColor">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Sign in with Microsoft
              </>
            )}
          </button>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4">
          {[
            { icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", label: "Email" },
            { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", label: "Teams" },
            { icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", label: "Calendar" },
          ].map((item) => (
            <div key={item.label} className="card text-center py-4 space-y-2">
              <svg className="w-5 h-5 mx-auto text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--text-secondary)]">
          Requires Azure AD app registration with Microsoft Graph permissions
        </p>
      </div>
    </main>
  );
}
