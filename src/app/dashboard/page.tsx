"use client";

import { useEffect, useState } from "react";

interface Stats {
  emailCount: number;
  chatCount: number;
  eventCount: number;
  agentActions: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    emailCount: 0,
    chatCount: 0,
    eventCount: 0,
    agentActions: 0,
  });
  const [recentLogs, setRecentLogs] = useState<Array<{ id: number; action: string; source: string; createdAt: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [emailsRes, teamsRes, calendarRes, logsRes] = await Promise.all([
          fetch("/api/emails?top=1"),
          fetch("/api/teams?type=chats"),
          fetch("/api/calendar?top=1"),
          fetch("/api/logs?limit=5"),
        ]);

        if (emailsRes.ok) {
          const data = await emailsRes.json();
          setStats((s) => ({ ...s, emailCount: data.emails?.length ?? 0 }));
        }
        if (teamsRes.ok) {
          const data = await teamsRes.json();
          setStats((s) => ({ ...s, chatCount: data.chats?.length ?? 0 }));
        }
        if (calendarRes.ok) {
          const data = await calendarRes.json();
          setStats((s) => ({ ...s, eventCount: data.events?.length ?? 0 }));
        }
        if (logsRes.ok) {
          const data = await logsRes.json();
          setRecentLogs(data.logs ?? []);
          setStats((s) => ({ ...s, agentActions: data.logs?.length ?? 0 }));
        }
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const statCards = [
    { label: "Emails", value: stats.emailCount, icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", color: "text-blue-400" },
    { label: "Chats", value: stats.chatCount, icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", color: "text-purple-400" },
    { label: "Events", value: stats.eventCount, icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", color: "text-green-400" },
    { label: "Agent Actions", value: stats.agentActions, icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", color: "text-amber-400" },
  ];

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

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Overview of your Microsoft communications
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
              </div>
              <div className={`p-2 rounded-lg bg-[var(--bg-primary)] ${card.color}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Recent Agent Activity</h2>
          {recentLogs.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-sm">No agent actions yet. Go to the AI Agent tab to get started.</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                  <div className="badge badge-info">{log.action}</div>
                  <span className="text-sm text-[var(--text-secondary)]">{log.source}</span>
                  <span className="text-xs text-[var(--text-secondary)] ml-auto">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Summarize Emails", href: "/dashboard/agent", desc: "Get AI summary of recent emails" },
              { label: "Teams Summary", href: "/dashboard/agent", desc: "Summarize Teams conversations" },
              { label: "Calendar Check", href: "/dashboard/calendar", desc: "Review upcoming events" },
              { label: "Draft Reply", href: "/dashboard/emails", desc: "AI-draft email replies" },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="p-3 rounded-lg border border-[var(--border)] hover:border-indigo-500/50 transition-colors"
              >
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{action.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
