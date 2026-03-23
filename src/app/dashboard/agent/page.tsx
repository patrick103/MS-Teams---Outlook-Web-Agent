"use client";

import { useEffect, useState, useRef } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextData, setContextData] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "tools">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          message: input,
          context: contextData || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const agentMsg: ChatMessage = { role: "assistant", content: data.reply, timestamp: new Date() };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        const err = await res.json();
        const errMsg: ChatMessage = { role: "assistant", content: `Error: ${err.error}`, timestamp: new Date() };
        setMessages((prev) => [...prev, errMsg]);
      }
    } catch (e) {
      const errMsg: ChatMessage = { role: "assistant", content: "Failed to connect to agent", timestamp: new Date() };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function quickAction(action: string, label: string) {
    setLoading(true);
    const userMsg: ChatMessage = { role: "user", content: `[${label}]`, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      let payload: Record<string, unknown> = { action };

      if (action === "summarize_emails") {
        const res = await fetch("/api/emails?top=20");
        if (res.ok) {
          const data = await res.json();
          payload.emails = data.emails;
        }
      } else if (action === "summarize_teams") {
        const chatsRes = await fetch("/api/teams?type=chats");
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json();
          if (chatsData.chats?.length > 0) {
            const msgRes = await fetch(`/api/teams?type=messages&chatId=${chatsData.chats[0].id}`);
            if (msgRes.ok) {
              const msgData = await msgRes.json();
              payload.teamsMessages = msgData.messages;
            }
          }
        }
      } else if (action === "calendar_suggest") {
        const res = await fetch("/api/calendar?top=20");
        if (res.ok) {
          const data = await res.json();
          payload.calendarEvents = data.events;
        }
      }

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.summary || data.reply || data.suggestion || data.notes || "Done";
        const agentMsg: ChatMessage = { role: "assistant", content, timestamp: new Date() };
        setMessages((prev) => [...prev, agentMsg]);
      }
    } catch (e) {
      const errMsg: ChatMessage = { role: "assistant", content: "Action failed", timestamp: new Date() };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  const quickActions = [
    { action: "summarize_emails", label: "Summarize Emails", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
    { action: "summarize_teams", label: "Summarize Teams", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
    { action: "calendar_suggest", label: "Calendar Insights", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">AI Agent</h1>
            <p className="text-xs text-[var(--text-secondary)]">Powered by OpenRouter</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "chat" ? "bg-indigo-600 text-white" : "text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab("tools")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "tools" ? "bg-indigo-600 text-white" : "text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              Quick Tools
            </button>
          </div>
        </div>

        {activeTab === "tools" && (
          <div className="flex gap-2 mt-3">
            {quickActions.map((qa) => (
              <button
                key={qa.action}
                onClick={() => quickAction(qa.action, qa.label)}
                disabled={loading}
                className="btn-secondary text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={qa.icon} />
                </svg>
                {qa.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context bar */}
      <div className="px-4 py-2 border-b border-[var(--border)]">
        <input
          type="text"
          placeholder="Paste context here (email content, chat messages, etc.)..."
          value={contextData}
          onChange={(e) => setContextData(e.target.value)}
          className="input-field text-xs"
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-600/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm">Ask me anything about your emails, Teams, or calendar</p>
              <p className="text-xs">Use Quick Tools for one-click actions</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`chat-bubble ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-agent"}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.role === "user" ? "text-white/60" : "text-[var(--text-secondary)]"}`}>
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="chat-bubble chat-bubble-agent">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-indigo-500 loading-dot" />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask the AI agent..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="input-field flex-1"
            disabled={loading}
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
