"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { PathHop, SearchResult, UserProfile } from "@/lib/types";

function FindConnectionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [query, setQuery] = useState(qParam);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<{ users: number; contacts: number; hint?: string } | null>(
    null,
  );
  const [searched, setSearched] = useState(false);
  const [path, setPath] = useState<PathHop[] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (!d.profile) router.replace("/onboarding");
        else setProfile(d.profile);
      });
  }, [router]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setMeta({ users: 0, contacts: 0, hint: "Type at least 2 characters" });
      setSearched(true);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setMeta(data.meta ?? { users: 0, contacts: 0 });
    setSearched(true);
  }, []);

  useEffect(() => {
    setQuery(qParam);
    if (qParam.trim().length >= 2) {
      void runSearch(qParam);
    }
  }, [qParam, runSearch]);

  async function findPath(target: SearchResult) {
    setLoading(true);
    setMessage("");
    setPath(null);
    setDistance(null);
    const res = await fetch("/api/path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPersonId: target.person_id }),
    });
    const data = await res.json();
    setLoading(false);
    if (!data.found) {
      setMessage(data.message ?? "No connection found.");
      return;
    }
    setPath(data.path);
    setDistance(data.distance);
  }

  return (
    <AppShell username={profile?.username}>
      <h1 className="font-display text-4xl tracking-tight">Find Connection</h1>
      <p className="mt-2 max-w-xl text-sm text-ink/65">
        Search Here Kathenas users or your imported contacts, then see the shortest path.
      </p>

      <form
        className="mt-6 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          router.replace(`/find?q=${encodeURIComponent(q)}`);
          void runSearch(q);
        }}
      >
        <input
          className="input-field"
          placeholder="Search by name or username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0">
          Search
        </button>
      </form>

      {searched && results.length === 0 ? (
        <p className="mt-6 max-w-xl text-sm text-ink/60">
          {meta?.hint ??
            "No Here Kathenas users or contacts matched. Try another name, or import contacts first."}
        </p>
      ) : null}

      {results.length > 0 && meta ? (
        <p className="mt-4 text-xs text-ink/50">
          {meta.users} user{meta.users === 1 ? "" : "s"} · {meta.contacts} contact
          {meta.contacts === 1 ? "" : "s"}
        </p>
      ) : null}

      <ul className="mt-4 max-w-xl space-y-2">
        {results.map((r) => (
          <li
            key={r.id}
            className="panel flex items-center justify-between gap-3 rounded-xl px-4 py-3"
          >
            <div>
              <p className="font-medium">{r.display_name}</p>
              <p className="text-sm text-ink/55">
                {r.kind === "user" && r.username
                  ? `@${r.username}`
                  : "Your contact (private)"}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={loading}
              onClick={() => findPath(r)}
            >
              Find path
            </button>
          </li>
        ))}
      </ul>

      {message ? (
        <div className="panel mt-8 max-w-xl rounded-2xl p-5 text-sm text-ink/70">{message}</div>
      ) : null}

      {path && distance !== null ? (
        <div className="panel mt-8 max-w-xl rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-ink/50">Result</p>
          <p className="font-display mt-1 text-3xl">
            {distance === 0
              ? "That's you"
              : distance === 1
                ? "You're connected directly"
                : `You are ${distance} steps away`}
          </p>
          <ol className="mt-6 space-y-0">
            {path.map((hop, i) => (
              <li key={hop.person_id} className="relative pl-8">
                {i < path.length - 1 ? (
                  <span className="absolute top-7 left-[11px] h-[calc(100%-8px)] w-px bg-ink/20" />
                ) : null}
                <span
                  className={`absolute top-1.5 left-1 h-4 w-4 rounded-full ring-2 ring-ink/70 ${
                    hop.kind === "self"
                      ? "bg-[var(--coral)]"
                      : hop.kind === "claimed"
                        ? "bg-[var(--teal)]"
                        : "bg-white"
                  }`}
                />
                <div className="pb-5">
                  {hop.username ? (
                    <Link href={`/profile/${hop.username}`} className="font-medium hover:underline">
                      {hop.label}
                    </Link>
                  ) : (
                    <span className="font-medium">
                      {hop.kind === "unclaimed" && !hop.from_import && hop.label === "Anonymous"
                        ? "Anonymous"
                        : hop.label}
                    </span>
                  )}
                  {hop.kind === "self" ? (
                    <p className="text-xs text-ink/50">You</p>
                  ) : hop.username ? (
                    <p className="text-xs text-ink/50">@{hop.username}</p>
                  ) : hop.from_import ? (
                    <p className="text-xs text-ink/50">In your contacts</p>
                  ) : hop.kind === "unclaimed" ? (
                    <p className="text-xs text-ink/50">Unclaimed</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function FindPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ink/50">Loading…</div>}>
      <FindConnectionInner />
    </Suspense>
  );
}
