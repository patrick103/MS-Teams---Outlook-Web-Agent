"use client";

import { useEffect, useState } from "react";

interface Chat {
  id: string;
  topic: string | null;
  chatType: string;
  updatedDateTime: string;
}

interface Message {
  id: string;
  body: { content: string; contentType: string };
  from: { user?: { displayName: string } };
  createdDateTime: string;
}

export default function TeamsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  useEffect(() => {
    loadChats();
  }, []);

  async function loadChats() {
    setLoading(true);
    try {
      const res = await fetch("/api/teams?type=chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats ?? []);
      }
    } catch (e) {
      console.error("Failed to load chats:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(chatId: string) {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/teams?type=messages&chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function sendMessage() {
    if (!selectedChat || !newMessage.trim()) return;
    try {
      await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: selectedChat.id, message: newMessage }),
      });
      setNewMessage("");
      loadMessages(selectedChat.id);
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  }

  async function summarizeChat() {
    if (messages.length === 0) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summarize_teams", teamsMessages: messages }),
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
    if (messages.length === 0) return;
    setReplyLoading(true);
    try {
      const context = messages
        .slice(0, 10)
        .map((m) => `${m.from?.user?.displayName}: ${m.body?.content?.replace(/<[^>]*>/g, "")}`)
        .join("\n");
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply_teams", context }),
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
      {/* Chat List */}
      <div className="w-80 border-r border-[var(--border)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold">Teams Chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-secondary)]">No chats found</p>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => { setSelectedChat(chat); setMessages([]); setSummary(""); setReplyDraft(""); loadMessages(chat.id); }}
                className={`w-full text-left p-4 border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors ${
                  selectedChat?.id === chat.id ? "bg-[var(--bg-hover)]" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 text-xs font-bold">
                    {(chat.topic ?? chat.chatType).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.topic ?? chat.chatType}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {new Date(chat.updatedDateTime).toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-semibold">{selectedChat.topic ?? selectedChat.chatType}</h2>
              <div className="flex gap-2">
                <button onClick={summarizeChat} disabled={summaryLoading || messages.length === 0} className="btn-primary text-xs disabled:opacity-50">
                  {summaryLoading ? "Summarizing..." : "AI Summary"}
                </button>
                <button onClick={draftReply} disabled={replyLoading || messages.length === 0} className="btn-secondary text-xs disabled:opacity-50">
                  {replyLoading ? "Drafting..." : "AI Reply"}
                </button>
              </div>
            </div>

            {summary && (
              <div className="p-3 mx-4 mt-3 rounded-lg bg-indigo-600/10 border border-indigo-500/20">
                <p className="text-xs font-medium text-indigo-400 mb-1">Conversation Summary</p>
                <p className="text-xs whitespace-pre-wrap">{summary}</p>
                <button onClick={() => setSummary("")} className="text-xs text-[var(--text-secondary)] mt-2 hover:text-white">Dismiss</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-indigo-500 loading-dot" />
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="chat-bubble chat-bubble-agent">
                    <p className="text-xs font-medium text-indigo-400 mb-1">
                      {msg.from?.user?.displayName ?? "Unknown"}
                    </p>
                    <p className="text-sm">{msg.body?.content?.replace(/<[^>]*>/g, "") ?? ""}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {new Date(msg.createdDateTime).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>

            {replyDraft && (
              <div className="p-3 mx-4 rounded-lg bg-green-600/10 border border-green-500/20">
                <p className="text-xs font-medium text-green-400 mb-1">AI Draft Reply</p>
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  className="input-field min-h-[80px] resize-y text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setNewMessage(replyDraft); setReplyDraft(""); }}
                    className="btn-primary text-xs"
                  >
                    Use as Message
                  </button>
                  <button onClick={() => setReplyDraft("")} className="btn-secondary text-xs">Dismiss</button>
                </div>
              </div>
            )}

            <div className="p-4 border-t border-[var(--border)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="input-field flex-1"
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button onClick={sendMessage} disabled={!newMessage.trim()} className="btn-primary disabled:opacity-50">
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)]">
            <p>Select a chat to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}
