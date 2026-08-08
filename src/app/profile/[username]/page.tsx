"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import type { ExternalProfile, UserProfile } from "@/lib/types";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [links, setLinks] = useState<ExternalProfile[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [isSelf, setIsSelf] = useState(false);
  const [phoneLinked, setPhoneLinked] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (!d.profile) router.replace("/onboarding");
        else setMe(d.profile);
      });
  }, [router]);

  useEffect(() => {
    if (!params.username) return;
    fetch(`/api/profile?username=${encodeURIComponent(params.username)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error ?? "Not found");
          return;
        }
        setProfile(d.profile);
        setLinks(d.links ?? []);
        setConnectionCount(d.connectionCount ?? 0);
        setIsSelf(Boolean(d.isSelf));
        setPhoneLinked(
          typeof d.phone_linked === "boolean" ? d.phone_linked : null,
        );
      });
  }, [params.username]);

  return (
    <AppShell username={me?.username}>
      {error ? (
        <p className="text-ink/60">{error}</p>
      ) : !profile ? (
        <p className="text-ink/50">Loading…</p>
      ) : (
        <div className="mx-auto max-w-lg">
          <div className="panel rounded-3xl p-8 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[var(--mist)] ring-2 ring-ink/20">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-display text-3xl">
                  {profile.display_name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="font-display text-4xl">{profile.display_name}</h1>
            <p className="text-ink/55">@{profile.username}</p>
            {isSelf && phoneLinked !== null ? (
              <p
                className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                  phoneLinked
                    ? "bg-[var(--teal)]/15 text-[var(--ink-soft)]"
                    : "bg-[var(--coral)]/15 text-[var(--coral-deep)]"
                }`}
              >
                {phoneLinked
                  ? "Phone linked, used for contact matching"
                  : "Phone not linked"}
              </p>
            ) : null}
            {profile.bio ? (
              <p className="mt-4 text-sm leading-relaxed text-ink/70">{profile.bio}</p>
            ) : null}
          </div>

          {links.length ? (
            <div className="mt-6">
              <h2 className="text-xs uppercase tracking-[0.14em] text-ink/50">Socials</h2>
              <ul className="mt-3 space-y-2">
                {links.map((l) => (
                  <li key={l.id}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="panel block rounded-xl px-4 py-3 text-sm hover:bg-white/70"
                    >
                      <span className="font-medium capitalize">{l.platform}</span>
                      <span className="ml-2 text-ink/50">{l.username || l.url}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6">
            <h2 className="text-xs uppercase tracking-[0.14em] text-ink/50">Network</h2>
            <p className="mt-2 font-display text-3xl">{connectionCount} connections</p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {!isSelf ? (
              <Link
                href={`/find?q=${encodeURIComponent(profile.username)}`}
                className="btn-primary"
              >
                Find connection
              </Link>
            ) : (
              <Link href="/profile/edit" className="btn-primary">
                Edit profile
              </Link>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
