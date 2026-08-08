"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/client";
import type { ExternalProfile, UserProfile } from "@/lib/types";

type LinkDraft = { platform: string; username: string; url: string };

export default function EditProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [links, setLinks] = useState<LinkDraft[]>([
    { platform: "github", username: "", url: "" },
  ]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (!d.profile) {
          router.replace("/onboarding");
          return;
        }
        setProfile(d.profile);
        setDisplayName(d.profile.display_name ?? "");
        setBio(d.profile.bio ?? "");
        setAvatarUrl(d.profile.avatar_url ?? "");
        const existing = (d.links as ExternalProfile[] | undefined)?.map((l) => ({
          platform: l.platform,
          username: l.username ?? "",
          url: l.url,
        }));
        if (existing?.length) setLinks(existing);
      });
  }, [router]);

  async function uploadAvatar(file: File) {
    if (!profile) return;
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profile.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl || null,
        links: links.filter((l) => l.url.trim()),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(data.error ?? "Save failed");
      return;
    }
    setStatus("Saved");
    if (profile) router.push(`/profile/${profile.username}`);
  }

  async function deleteAccount() {
    if (!confirm("Delete your account and unlink your phone hash? This cannot be undone.")) {
      return;
    }
    const res = await fetch("/api/account/delete", { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Delete failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AppShell username={profile?.username}>
      <h1 className="font-display text-4xl tracking-tight">Edit profile</h1>
      <form onSubmit={save} className="mt-6 max-w-xl space-y-4">
        <label className="block text-sm">
          Display name
          <input
            className="input-field mt-1.5"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Bio
          <textarea
            className="input-field mt-1.5 min-h-24"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Avatar
          <input
            type="file"
            accept="image/*"
            className="mt-1.5 block text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
            }}
          />
        </label>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium">Social links</p>
          {links.map((link, i) => (
            <div key={i} className="mb-2 grid gap-2 sm:grid-cols-3">
              <input
                className="input-field"
                placeholder="platform"
                value={link.platform}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], platform: e.target.value };
                  setLinks(next);
                }}
              />
              <input
                className="input-field"
                placeholder="@username"
                value={link.username}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], username: e.target.value };
                  setLinks(next);
                }}
              />
              <input
                className="input-field"
                placeholder="https://"
                value={link.url}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], url: e.target.value };
                  setLinks(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="text-sm text-[var(--teal)]"
            onClick={() =>
              setLinks((prev) => [...prev, { platform: "", username: "", url: "" }])
            }
          >
            + Add link
          </button>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Save profile"}
        </button>
        {status ? <p className="text-sm text-ink/65">{status}</p> : null}
      </form>

      <div className="mt-16 max-w-xl border-t border-[var(--line)] pt-8">
        <h2 className="font-display text-2xl text-[var(--coral-deep)]">Danger zone</h2>
        <p className="mt-2 text-sm text-ink/60">
          Delete your account. Your graph node becomes unclaimed; phone hash is cleared.
        </p>
        <button type="button" className="btn-secondary mt-4" onClick={deleteAccount}>
          Delete account
        </button>
      </div>
    </AppShell>
  );
}
