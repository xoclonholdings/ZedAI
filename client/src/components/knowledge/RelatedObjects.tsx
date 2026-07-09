import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Link as LinkIcon } from "lucide-react";

import type {
  AnyMemoryObject,
  ObjectGraph,
  ObjectMemoryType,
  ObjectRelationship,
} from "@shared/object-memory-types";

/**
 * Shared relationship chip strip.
 *
 * Renders a low-density row of chips showing what an object connects
 * to in the applied graph — Apple-simple, not a graph viz. Resolves
 * the target either by graph object id or by (canonicalName, type),
 * so it works from callers that don't know graph ids (e.g. the
 * projects filing store).
 *
 * Renders nothing when the target isn't in the graph or has no
 * relationships — never adds visual noise.
 */

interface Props {
  objectId?: string;
  canonicalName?: string;
  type?: ObjectMemoryType;
  graph?: ObjectGraph | null;
  className?: string;
  label?: string;
  limit?: number;
}

function friendlyRel(t: string): string {
  return t.replace(/_/g, " ").toLowerCase();
}

function useResolvedGraph(external?: ObjectGraph | null) {
  const [graph, setGraph] = useState<ObjectGraph | null>(external || null);
  useEffect(() => {
    if (external) {
      setGraph(external);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/memory/graph", { credentials: "include" });
        if (!res.ok) return;
        const g = await res.json();
        if (!cancelled) setGraph(g);
      } catch {
        // silent — the chip strip is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [external]);
  return graph;
}

export function RelatedObjects({
  objectId,
  canonicalName,
  type,
  graph: graphProp,
  className,
  label = "Connected",
  limit = 8,
}: Props) {
  const [, navigate] = useLocation();
  const graph = useResolvedGraph(graphProp);

  const target = useMemo<AnyMemoryObject | null>(() => {
    if (!graph) return null;
    if (objectId) return graph.objects.find((o) => o.id === objectId) || null;
    if (canonicalName) {
      const needle = canonicalName.trim().toLowerCase();
      return (
        graph.objects.find(
          (o) =>
            o.canonicalName.trim().toLowerCase() === needle &&
            (!type || o.type === type),
        ) || null
      );
    }
    return null;
  }, [graph, objectId, canonicalName, type]);

  const byId = useMemo(() => {
    const m = new Map<string, AnyMemoryObject>();
    for (const o of graph?.objects || []) m.set(o.id, o);
    return m;
  }, [graph]);

  const related = useMemo(() => {
    if (!target || !graph) return [] as Array<{
      other: AnyMemoryObject;
      rel: ObjectRelationship;
      outgoing: boolean;
    }>;
    const out: Array<{ other: AnyMemoryObject; rel: ObjectRelationship; outgoing: boolean }> = [];
    for (const rel of graph.relationships) {
      if (rel.fromObjectId === target.id) {
        const other = byId.get(rel.toObjectId);
        if (other) out.push({ other, rel, outgoing: true });
      } else if (rel.toObjectId === target.id) {
        const other = byId.get(rel.fromObjectId);
        if (other) out.push({ other, rel, outgoing: false });
      }
    }
    return out.slice(0, limit);
  }, [target, graph, byId, limit]);

  if (!target || related.length === 0) return null;

  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {related.map(({ other, rel }) => (
          <button
            key={rel.id}
            type="button"
            onClick={() => {
              if (other.type === "decision") navigate(`/decisions/${other.id}`);
              else navigate("/learning");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/85 hover:border-cyan-400/40 hover:bg-cyan-400/[0.08] transition-colors"
            title={rel.evidence || undefined}
          >
            <LinkIcon size={10} className="text-cyan-300/70" />
            <span className="truncate max-w-[18ch]">{other.canonicalName}</span>
            <span className="text-white/40 text-[10px]">
              · {friendlyRel(rel.relationshipType)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
