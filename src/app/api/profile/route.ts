import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function phoneLinkedForPerson(
  service: ReturnType<typeof createServiceClient>,
  personId: string,
): Promise<boolean> {
  const { data } = await service
    .from("persons")
    .select("phone_hash")
    .eq("id", personId)
    .maybeSingle();
  return Boolean(data?.phone_hash);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const service = createServiceClient();

  if (username) {
    const { data: profile } = await service
      .from("users")
      .select("id, person_id, username, display_name, avatar_url, bio, created_at")
      .eq("username", username.toLowerCase())
      .eq("onboarding_completed", true)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: links } = await service
      .from("external_profiles")
      .select("id, platform, username, url")
      .eq("user_id", profile.id);

    const { count } = await service
      .from("connections")
      .select("id", { count: "exact", head: true })
      .or(`person_a_id.eq.${profile.person_id},person_b_id.eq.${profile.person_id}`);

    const isSelf = profile.id === user.id;
    const phone_linked = isSelf
      ? await phoneLinkedForPerson(service, profile.person_id)
      : undefined;

    return NextResponse.json({
      profile,
      links: links ?? [],
      connectionCount: count ?? 0,
      isSelf,
      phone_linked,
    });
  }

  const { data: profile } = await service
    .from("users")
    .select("id, person_id, username, display_name, avatar_url, bio, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  const { data: links } = await service
    .from("external_profiles")
    .select("id, platform, username, url")
    .eq("user_id", user.id);

  const phone_linked = await phoneLinkedForPerson(service, profile.person_id);

  return NextResponse.json({
    profile,
    links: links ?? [],
    isSelf: true,
    phone_linked,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const service = createServiceClient();

  const updates: Record<string, string | null> = {};
  if (typeof body.display_name === "string") {
    updates.display_name = body.display_name.trim();
  }
  if (typeof body.bio === "string") {
    updates.bio = body.bio.trim() || null;
  }
  if (typeof body.avatar_url === "string") {
    updates.avatar_url = body.avatar_url || null;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await service.from("users").update(updates).eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.links)) {
    await service.from("external_profiles").delete().eq("user_id", user.id);
    const rows = body.links
      .filter((l: { platform?: string; url?: string }) => l.platform && l.url)
      .map((l: { platform: string; username?: string; url: string }) => ({
        user_id: user.id,
        platform: String(l.platform).trim(),
        username: l.username ? String(l.username).trim() : null,
        url: String(l.url).trim(),
      }));
    if (rows.length) {
      const { error } = await service.from("external_profiles").insert(rows);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
