"use client";

import { useEffect, useState } from "react";

interface Email {
  id: string;
  subject: string;
  bodyPreview: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
  importance: string;
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyInstructions, setReplyInstructions] = useState("");

  useEffect(() => {
    loadEmails();
  }, []);

  async function loadEmails() {
    setLoading(true);
    try {
      const res = await fetch("/api/emails?top=50");
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails ?? []);
      }
    } catch (e) {
      console.error("Failed to load emails:", e);
    } finally {
      setLoading(false);
    }
  }

  async function summarizeAll() {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summarize_emails", emails }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch (e) {
      console.error("Summarize failed:", e);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function draftReply() {
    if (!selectedEmail) return;
    setReplyLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply_email",
          emailSubject: selectedEmail.subject,
          emailBody: selectedEmail.bodyPreview,
          instructions: replyInstructions || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplyDraft(data.reply);
      }
    } catch (e) {
      console.error("Draft reply failed:", e);
    } finally {
      setReplyLoading(false);
    }
  }

  async function sendReply() {
    if (!selectedEmail || !replyDraft) return;
    try {
      await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          messageId: selectedEmail.id,
          content: replyDraft,
        }),
      });
      setReplyDraft("");
      setReplyInstructions("");
    } catch (e) {
      console.error("Send reply failed:", e);
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

  return (
    <div className="flex h-full">
      {/* Email List */}
      <div className="w-80 border-r border-[var(--border)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold">Inbox</h2>
          <button onClick={summarizeAll} disabled={summaryLoading || emails.length === 0} className="btn-primary text-xs disabled:opacity-50">
            {summaryLoading ? "Summarizing..." : "AI Summary"}
          </button>
        </div>

        {summary && (
          <div className="p-3 m-3 rounded-lg bg-indigo-600/10 border border-indigo-500/20">
            <p className="text-xs font-medium text-indigo-400 mb-1">Email Summary</p>
            <p className="text-xs whitespace-pre-wrap">{summary}</p>
            <button onClick={() => setSummary("")} className="text-xs text-[var(--text-secondary)] mt-2 hover:text-white">Dismiss</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {emails.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-secondary)]">No emails found</p>
          ) : (
            emails.map((email) => (
              <button
                key={email.id}
                onClick={() => { setSelectedEmail(email); setReplyDraft(""); setReplyInstructions(""); }}
                className={`w-full text-left p-4 border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors ${
                  selectedEmail?.id === email.id ? "bg-[var(--bg-hover)]" : ""
                } ${!email.isRead ? "border-l-2 border-l-indigo-500" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium truncate ${!email.isRead ? "text-white" : "text-[var(--text-secondary)]"}`}>
                    {email.from?.emailAddress?.name ?? "Unknown"}
                  </span>
                  {email.importance === "high" && <span className="badge badge-danger">!</span>}
                </div>
                <p className={`text-sm truncate ${!email.isRead ? "font-medium" : ""}`}>{email.subject}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate mt-1">{email.bodyPreview}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {new Date(email.receivedDateTime).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Email Detail */}
      <div className="flex-1 flex flex-col">
        {selectedEmail ? (
          <>
            <div className="p-6 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold">{selectedEmail.subject}</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                From: {selectedEmail.from?.emailAddress?.name} &lt;{selectedEmail.from?.emailAddress?.address}&gt;
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {new Date(selectedEmail.receivedDateTime).toLocaleString()}
              </p>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{selectedEmail.bodyPreview}</p>
            </div>

            {/* Reply Section */}
            <div className="p-4 border-t border-[var(--border)] space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Optional instructions for AI reply..."
                  value={replyInstructions}
                  onChange={(e) => setReplyInstructions(e.target.value)}
                  className="input-field flex-1"
                  onKeyDown={(e) => e.key === "Enter" && draftReply()}
                />
                <button onClick={draftReply} disabled={replyLoading} className="btn-primary disabled:opacity-50">
                  {replyLoading ? "Drafting..." : "AI Draft Reply"}
                </button>
              </div>

              {replyDraft && (
                <div className="space-y-2">
                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    className="input-field min-h-[120px] resize-y"
                  />
                  <div className="flex gap-2">
                    <button onClick={sendReply} className="btn-primary">Send Reply</button>
                    <button onClick={() => setReplyDraft("")} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)]">
            <p>Select an email to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
