"use client";

import { useState, useTransition } from "react";
import { approveHwidResetAction, denyHwidResetAction } from "@/actions/hwidReset";
import { CheckCircle, XCircle, Monitor, Cpu, MemoryStick, MapPin, Clock } from "lucide-react";

interface HwidDetails {
  cpu?: string;
  gpu?: string;
  ramGb?: number;
}

interface Location {
  ip?: string;
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
  seenAt?: string;
}

interface HwidRequest {
  id: number;
  userId: number;
  username: string | null;
  email: string | null;
  status: string;
  oldHwid: string | null;
  oldHwidDetails: HwidDetails | null;
  oldHwidLocations: Location[] | null;
  newHwid: string;
  newHwidDetails: HwidDetails | null;
  requestIp: string | null;
  requestLocation: Location | null;
  requestedAt: string;
  resolvedAt: string | null;
}

function HwidHash({ hash }: { hash: string | null }) {
  if (!hash) return <span className="text-zinc-500 text-xs italic">Not bound</span>;
  return (
    <span className="font-mono text-xs text-zinc-400 break-all">
      {hash.slice(0, 12)}…{hash.slice(-8)}
    </span>
  );
}

function HwDetails({ details, label }: { details: HwidDetails | null; label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{label}</p>
      {details ? (
        <>
          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
            <Cpu className="w-3 h-3 text-purple-400 shrink-0" />
            <span className="truncate">{details.cpu || "—"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
            <Monitor className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="truncate">{details.gpu || "—"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
            <MemoryStick className="w-3 h-3 text-green-400 shrink-0" />
            <span>{details.ramGb != null ? `${details.ramGb} GB RAM` : "—"}</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-zinc-500 italic">No hardware data available</p>
      )}
    </div>
  );
}

function LocationList({ locations, label }: { locations: Location[] | null; label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{label}</p>
      {locations && locations.length > 0 ? (
        <div className="space-y-1 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
          {locations.map((loc, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
              <MapPin className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
              <span>
                {loc.city && loc.country ? `${loc.city}, ${loc.country}` : "Unknown"}
                {loc.ip && <span className="ml-1 text-zinc-600">({loc.ip})</span>}
                {loc.seenAt && (
                  <span className="ml-1 text-zinc-600 text-[10px]">
                    {new Date(loc.seenAt).toLocaleDateString()}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500 italic">No location history</p>
      )}
    </div>
  );
}

function SingleLocation({ loc, label }: { loc: Location | null; label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{label}</p>
      {loc ? (
        <div className="flex items-center gap-1.5 text-xs text-zinc-300">
          <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
          <span>
            {loc.city && loc.country ? `${loc.city}, ${loc.country}` : "Unknown"}
            {loc.ip && <span className="ml-1 text-zinc-500">({loc.ip})</span>}
          </span>
        </div>
      ) : (
        <p className="text-xs text-zinc-500 italic">Unknown</p>
      )}
    </div>
  );
}

function RequestCard({ request, onAction }: { request: HwidRequest; onAction: () => void }) {
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);

  const isPending = request.status === "pending";

  function handle(action: "approve" | "deny") {
    setActionError(null);
    startTransition(async () => {
      const fn = action === "approve" ? approveHwidResetAction : denyHwidResetAction;
      const result = await fn(request.id);
      if (result.error) {
        setActionError(result.error);
      } else {
        setActionDone(action === "approve" ? "Approved" : "Denied");
        onAction();
      }
    });
  }

  const statusColor =
    request.status === "approved" ? "text-green-400 border-green-500/30 bg-green-500/5" :
    request.status === "denied"   ? "text-red-400 border-red-500/30 bg-red-500/5" :
                                    "text-amber-400 border-amber-500/30 bg-amber-500/5";

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-white/5 bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300">
            {request.username?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{request.username ?? "Unknown"}</p>
            <p className="text-xs text-zinc-500">{request.email ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="w-3 h-3" />
            {new Date(request.requestedAt).toLocaleString()}
          </div>
          <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor}`}>
            {actionDone ?? request.status}
          </span>
        </div>
      </div>

      {/* Body — two columns: OLD | NEW */}
      <div className="grid md:grid-cols-2 gap-px bg-white/5">
        {/* OLD machine */}
        <div className="bg-[#0d0a12] p-5 space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            Current / Old Machine
          </p>
          <div>
            <p className="text-[11px] text-zinc-500 mb-0.5">HWID Hash</p>
            <HwidHash hash={request.oldHwid} />
          </div>
          <HwDetails details={request.oldHwidDetails} label="Hardware" />
          <LocationList locations={request.oldHwidLocations} label="Locations seen at" />
        </div>

        {/* NEW machine */}
        <div className="bg-[#0d0a12] p-5 space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            New Machine (Failed Attempt)
          </p>
          <div>
            <p className="text-[11px] text-zinc-500 mb-0.5">HWID Hash</p>
            <HwidHash hash={request.newHwid} />
          </div>
          <HwDetails details={request.newHwidDetails} label="Hardware" />
          <SingleLocation loc={request.requestLocation} label="Request location" />
        </div>
      </div>

      {/* Footer actions */}
      {isPending && !actionDone && (
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-white/5">
          {actionError && <p className="text-xs text-red-400 mr-auto">{actionError}</p>}
          <button
            onClick={() => handle("deny")}
            disabled={pending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium border border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/15 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Deny
          </button>
          <button
            onClick={() => handle("approve")}
            disabled={pending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium border border-green-500/30 text-green-400 bg-green-500/5 hover:bg-green-500/15 transition-colors disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" /> Approve
          </button>
        </div>
      )}
    </div>
  );
}

export function HwidRequestsTab({ initialRequests }: { initialRequests: HwidRequest[] }) {
  const [filter, setFilter] = useState<"pending" | "approved" | "denied" | "all">("pending");
  const [requests, setRequests] = useState<HwidRequest[]>(initialRequests);
  const [refreshing, startRefresh] = useTransition();

  async function refresh() {
    // Trigger server revalidation and let Next.js refresh the data via router
    startRefresh(async () => {
      // Simple client-side reload to pick up revalidated data
      window.location.reload();
    });
  }

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  const counts = {
    pending:  requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    denied:   requests.filter(r => r.status === "denied").length,
    all:      requests.length,
  };

  const tabs: Array<{ key: typeof filter; label: string }> = [
    { key: "pending",  label: `Pending (${counts.pending})`  },
    { key: "approved", label: `Approved (${counts.approved})` },
    { key: "denied",   label: `Denied (${counts.denied})`   },
    { key: "all",      label: `All (${counts.all})`         },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-filter tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              filter === t.key
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          No {filter === "all" ? "" : filter} HWID reset requests.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => (
            <RequestCard key={req.id} request={req} onAction={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
