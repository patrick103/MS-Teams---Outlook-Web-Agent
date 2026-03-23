"use client";

import { useEffect, useState } from "react";

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  isAllDay: boolean;
  importance: string;
  organizer?: { emailAddress: { name: string } };
  bodyPreview: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    subject: "",
    start: "",
    end: "",
    body: "",
    location: "",
    attendees: "",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar?top=50");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } catch (e) {
      console.error("Failed to load events:", e);
    } finally {
      setLoading(false);
    }
  }

  async function getSuggestions() {
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "calendar_suggest", calendarEvents: events }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestion(data.suggestion);
      }
    } catch (e) {
      console.error("Suggestions failed:", e);
    } finally {
      setSuggestLoading(false);
    }
  }

  async function createEvent() {
    setCreating(true);
    try {
      const payload = {
        subject: newEvent.subject,
        start: newEvent.start,
        end: newEvent.end,
        body: newEvent.body || undefined,
        location: newEvent.location || undefined,
        attendees: newEvent.attendees ? newEvent.attendees.split(",").map((s) => s.trim()) : undefined,
      };
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setNewEvent({ subject: "", start: "", end: "", body: "", location: "", attendees: "" });
        loadEvents();
      }
    } catch (e) {
      console.error("Failed to create event:", e);
    } finally {
      setCreating(false);
    }
  }

  function groupEventsByDay(events: CalendarEvent[]) {
    const groups: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      const date = new Date(event.start.dateTime).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
    });
    return groups;
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

  const grouped = groupEventsByDay(events);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Upcoming events for the next 7 days</p>
        </div>
        <div className="flex gap-2">
          <button onClick={getSuggestions} disabled={suggestLoading || events.length === 0} className="btn-primary disabled:opacity-50">
            {suggestLoading ? "Analyzing..." : "AI Insights"}
          </button>
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-secondary">
            {showCreateForm ? "Cancel" : "New Event"}
          </button>
        </div>
      </div>

      {suggestion && (
        <div className="card bg-indigo-600/5 border-indigo-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-400 mb-2">AI Calendar Insights</p>
              <p className="text-sm whitespace-pre-wrap">{suggestion}</p>
            </div>
            <button onClick={() => setSuggestion("")} className="text-[var(--text-secondary)] hover:text-white text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="card space-y-4">
          <h3 className="font-semibold">Create New Event</h3>
          <input
            type="text"
            placeholder="Event title"
            value={newEvent.subject}
            onChange={(e) => setNewEvent({ ...newEvent, subject: e.target.value })}
            className="input-field"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">Start</label>
              <input
                type="datetime-local"
                value={newEvent.start}
                onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">End</label>
              <input
                type="datetime-local"
                value={newEvent.end}
                onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <input
            type="text"
            placeholder="Location (optional)"
            value={newEvent.location}
            onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
            className="input-field"
          />
          <input
            type="text"
            placeholder="Attendees (comma-separated emails)"
            value={newEvent.attendees}
            onChange={(e) => setNewEvent({ ...newEvent, attendees: e.target.value })}
            className="input-field"
          />
          <textarea
            placeholder="Description (optional)"
            value={newEvent.body}
            onChange={(e) => setNewEvent({ ...newEvent, body: e.target.value })}
            className="input-field min-h-[80px] resize-y"
          />
          <button
            onClick={createEvent}
            disabled={creating || !newEvent.subject || !newEvent.start || !newEvent.end}
            className="btn-primary disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Event"}
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--text-secondary)]">No upcoming events</p>
        </div>
      ) : (
        Object.entries(grouped).map(([day, dayEvents]) => (
          <div key={day} className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">{day}</h3>
            <div className="space-y-2">
              {dayEvents.map((event) => (
                <div key={event.id} className="card flex items-start gap-4">
                  <div className="text-center min-w-[60px]">
                    {event.isAllDay ? (
                      <span className="text-xs text-[var(--text-secondary)]">All day</span>
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          {new Date(event.start.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {new Date(event.end.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{event.subject}</p>
                      {event.importance === "high" && <span className="badge badge-danger">High</span>}
                    </div>
                    {event.location?.displayName && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Location: {event.location.displayName}
                      </p>
                    )}
                    {event.organizer?.emailAddress?.name && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        Organized by: {event.organizer.emailAddress.name}
                      </p>
                    )}
                    {event.bodyPreview && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{event.bodyPreview}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
