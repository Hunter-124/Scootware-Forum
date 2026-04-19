"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Bug, Monitor, Clock, Fingerprint, Info, ChevronLeft, ChevronRight } from "lucide-react";

interface LoaderEvent {
  id: number;
  userId: number | null;
  username: string | null;
  hwid: string | null;
  ip: string | null;
  userAgent: string | null;
  eventType: string;
  vmDetected: boolean;
  debuggerDetected: boolean;
  details: string | null;  // semicolon-separated list of specific triggers
  productId: string | null;
  loaderVersion: string | null;
  createdAt: string;
}

interface LoaderEventResponse {
  events: LoaderEvent[];
  total: number;
  page: number;
  totalPages: number;
}

// ── Badge component ──────────────────────────────────────────────────────────

function EventTypeBadge({ event }: { event: LoaderEvent }) {
  if (event.vmDetected && event.debuggerDetected) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/15 border border-red-500/40 text-red-300">
        <AlertTriangle className="w-3 h-3" /> VM + Debugger
      </span>
    );
  }
  if (event.vmDetected) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-500/15 border border-orange-500/40 text-orange-300">
        <Monitor className="w-3 h-3" /> VM Detected
      </span>
    );
  }
  if (event.debuggerDetected) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-yellow-500/15 border border-yellow-500/40 text-yellow-300">
        <Bug className="w-3 h-3" /> Debugger
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-700/50 border border-zinc-600/40 text-zinc-400">
      <Info className="w-3 h-3" /> {event.eventType}
    </span>
  );
}

// ── Trigger list ─────────────────────────────────────────────────────────────

function TriggerList({ details }: { details: string | null }) {
  if (!details || details === "unknown" || details === "none") {
    return <p className="text-xs text-zinc-600 italic">No trigger details recorded</p>;
  }

  const triggers = details.split(";").map(t => t.trim()).filter(Boolean);

  return (
    <ul className="space-y-1">
      {triggers.map((trigger, i) => {
        // Color-code based on trigger content
        const isDebugger = /debugger|debug|breakpoint|heap flag|IsDebuggerPresent|NtQuery|remote|analysis tool/i.test(trigger);
        const isVM = /vm|hypervisor|cpuid|registry|vmware|virtualbox|mac address|rdtsc|process running|service/i.test(trigger);
        const dotColor = isDebugger && isVM ? "bg-red-400" : isDebugger ? "bg-yellow-400" : isVM ? "bg-orange-400" : "bg-zinc-500";

        return (
          <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
            <span>{trigger}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: LoaderEvent }) {
  const borderColor = event.vmDetected && event.debuggerDetected
    ? "border-red-500/20"
    : event.vmDetected
    ? "border-orange-500/20"
    : event.debuggerDetected
    ? "border-yellow-500/20"
    : "border-white/5";

  return (
    <div className={`rounded-xl border ${borderColor} bg-white/[0.02] overflow-hidden`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-white/5 bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            {event.vmDetected && event.debuggerDetected ? (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            ) : event.vmDetected ? (
              <Monitor className="w-4 h-4 text-orange-400" />
            ) : (
              <Bug className="w-4 h-4 text-yellow-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {event.username ?? <span className="text-zinc-500 italic">Unknown user</span>}
            </p>
            <p className="text-xs text-zinc-500">
              {event.ip ?? "Unknown IP"}
              {event.productId && <span className="ml-2 text-zinc-600">· {event.productId}</span>}
              {event.loaderVersion && <span className="ml-2 text-zinc-600">v{event.loaderVersion}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <EventTypeBadge event={event} />
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="w-3 h-3" />
            {new Date(event.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid md:grid-cols-2 gap-6">
        {/* Detection vectors */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
            Detection Vectors
          </p>
          <TriggerList details={event.details} />
        </div>

        {/* Machine info */}
        <div className="space-y-3">
          {event.hwid && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">HWID</p>
              <div className="flex items-center gap-1.5">
                <Fingerprint className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="font-mono text-xs text-zinc-400">
                  {event.hwid.slice(0, 12)}…{event.hwid.slice(-8)}
                </span>
              </div>
            </div>
          )}
          {event.userAgent && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">User Agent</p>
              <p className="text-xs text-zinc-500 truncate">{event.userAgent}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main tab component ───────────────────────────────────────────────────────

export function LoaderEventsTab({ initialData }: { initialData: LoaderEventResponse }) {
  const [data, setData] = useState<LoaderEventResponse>(initialData);
  const [filter, setFilter] = useState<"all" | "vm" | "debugger" | "both">("all");
  const [_pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  async function loadPage(page: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/loader-events?page=${page}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = data.events.filter(e => {
    if (filter === "all") return true;
    if (filter === "both") return e.vmDetected && e.debuggerDetected;
    if (filter === "vm") return e.vmDetected && !e.debuggerDetected;
    if (filter === "debugger") return e.debuggerDetected && !e.vmDetected;
    return true;
  });

  const filterTabs = [
    { key: "all" as const, label: "All Events" },
    { key: "both" as const, label: "VM + Debugger" },
    { key: "vm" as const, label: "VM Only" },
    { key: "debugger" as const, label: "Debugger Only" },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-filter tabs */}
      <div className="flex gap-1 border-b border-white/5 overflow-x-auto">
        {filterTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              filter === t.key
                ? "border-red-500 text-red-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>Total recorded: <span className="text-white font-medium">{data.total}</span></span>
        <span>Page {data.page} of {data.totalPages}</span>
        {loading && <span className="text-purple-400 animate-pulse">Loading…</span>}
      </div>

      {/* Event list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          No detection events found.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={data.page <= 1 || loading}
            onClick={() => startTransition(() => { loadPage(data.page - 1); })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-zinc-400 border border-white/10 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-zinc-500">{data.page} / {data.totalPages}</span>
          <button
            disabled={data.page >= data.totalPages || loading}
            onClick={() => startTransition(() => { loadPage(data.page + 1); })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-zinc-400 border border-white/10 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
