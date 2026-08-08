"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { NetworkGraph } from "@/components/graph/NetworkGraph";
import { NodeSheet } from "@/components/graph/NodeSheet";
import type { GraphEdge, GraphNode, UserProfile } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState({ total: 0, claimed: 0, unclaimed: 0 });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const me = await fetch("/api/profile");
    const meData = await me.json();
    if (!meData.profile) {
      router.replace("/onboarding");
      return;
    }
    if (!meData.profile.onboarding_completed) {
      router.replace("/onboarding");
      return;
    }
    setProfile(meData.profile);

    const graph = await fetch("/api/graph");
    const graphData = await graph.json();
    if (graph.ok) {
      setNodes(graphData.nodes ?? []);
      setEdges(graphData.edges ?? []);
      setStats(graphData.stats ?? { total: 0, claimed: 0, unclaimed: 0 });
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/find?q=${encodeURIComponent(q)}`);
  }

  return (
    <AppShell username={profile?.username} fullBleed>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--line)] bg-[rgba(247,243,238,0.7)] px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">Your network</h1>
            <p className="text-sm text-ink/60">
              {loading
                ? "Loading…"
                : `${stats.total} people · ${stats.claimed} Here Kathenas · ${stats.unclaimed} unclaimed`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={onSearch} className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
              <input
                className="input-field"
                placeholder="Search people…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="submit" className="btn-primary shrink-0 text-sm">
                Search
              </button>
            </form>
            <Link href="/find" className="btn-secondary text-sm">
              Find
            </Link>
            <Link href="/import" className="btn-secondary text-sm">
              Import
            </Link>
          </div>
        </div>

        <div className="relative min-h-[50vh] flex-1">
          {loading ? (
            <div className="flex h-full min-h-[50vh] items-center justify-center text-ink/50">
              Mapping your people…
            </div>
          ) : nodes.length <= 1 ? (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="font-display text-3xl">Your graph is waiting</p>
              <p className="max-w-md text-sm text-ink/65">
                Import contacts to see how your network connects. Unclaimed people appear as
                empty nodes until they join.
              </p>
              <Link href="/import" className="btn-primary">
                Import contacts
              </Link>
            </div>
          ) : (
            <NetworkGraph
              nodes={nodes}
              edges={edges}
              onNodeClick={setSelected}
              className="absolute inset-0 h-full w-full min-h-[50vh]"
            />
          )}
        </div>
      </div>

      <NodeSheet node={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}
