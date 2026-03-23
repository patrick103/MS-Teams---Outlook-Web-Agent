"use client";

import { useEffect, useState } from "react";

interface Settings {
  openrouterApiKey: string;
  openrouterModel: string;
  agentAutoReply: boolean;
  agentAutoSummary: boolean;
  agentTone: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    openrouterApiKey: "",
    openrouterModel: "anthropic/claude-sonnet-4",
    agentAutoReply: false,
    agentAutoSummary: false,
    agentTone: "professional",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage("Settings saved successfully");
        loadSettings();
      } else {
        setMessage("Failed to save settings");
      }
    } catch (e) {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-indigo-500 loading-dot" />
          ))}
        </div>
      </div>
    );
  }

  const models = [
    { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
    { value: "anthropic/claude-opus-4", label: "Claude Opus 4" },
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro" },
    { value: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash" },
    { value: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
  ];

  const tones = [
    { value: "professional", label: "Professional" },
    { value: "friendly", label: "Friendly" },
    { value: "formal", label: "Formal" },
    { value: "casual", label: "Casual" },
    { value: "concise", label: "Concise" },
  ];

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">Configure your AI agent and integrations</p>
      </div>

      <div className="card space-y-6">
        <h2 className="font-semibold">OpenRouter Configuration</h2>

        <div>
          <label className="text-sm text-[var(--text-secondary)] block mb-1">API Key</label>
          <input
            type="password"
            placeholder="sk-or-..."
            value={settings.openrouterApiKey}
            onChange={(e) => setSettings({ ...settings, openrouterApiKey: e.target.value })}
            className="input-field"
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Get your key from{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
              openrouter.ai/keys
            </a>
          </p>
        </div>

        <div>
          <label className="text-sm text-[var(--text-secondary)] block mb-1">AI Model</label>
          <select
            value={settings.openrouterModel}
            onChange={(e) => setSettings({ ...settings, openrouterModel: e.target.value })}
            className="input-field"
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card space-y-6">
        <h2 className="font-semibold">Agent Preferences</h2>

        <div>
          <label className="text-sm text-[var(--text-secondary)] block mb-1">Communication Tone</label>
          <select
            value={settings.agentTone}
            onChange={(e) => setSettings({ ...settings, agentTone: e.target.value })}
            className="input-field"
          >
            {tones.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p className="text-xs text-[var(--text-secondary)] mt-1">The tone the AI agent uses when drafting replies</p>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Auto-Reply</p>
            <p className="text-xs text-[var(--text-secondary)]">Automatically draft replies to new emails</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, agentAutoReply: !settings.agentAutoReply })}
            className={`w-11 h-6 rounded-full transition-colors ${settings.agentAutoReply ? "bg-indigo-600" : "bg-[var(--border)]"}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.agentAutoReply ? "translate-x-5.5" : "translate-x-0.5"}`} />
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Auto-Summarize</p>
            <p className="text-xs text-[var(--text-secondary)]">Automatically summarize new email threads</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, agentAutoSummary: !settings.agentAutoSummary })}
            className={`w-11 h-6 rounded-full transition-colors ${settings.agentAutoSummary ? "bg-indigo-600" : "bg-[var(--border)]"}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.agentAutoSummary ? "translate-x-5.5" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={saveSettings} disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {message && (
          <p className={`text-sm ${message.includes("success") ? "text-green-400" : "text-red-400"}`}>{message}</p>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Microsoft Integration</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-[var(--text-secondary)]">Status</span>
            <span className="badge badge-success">Connected</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-[var(--text-secondary)]">Permissions</span>
            <span className="text-xs">Mail, Calendar, Teams</span>
          </div>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          To re-authenticate or change permissions, sign out and sign back in.
        </p>
      </div>
    </div>
  );
}
