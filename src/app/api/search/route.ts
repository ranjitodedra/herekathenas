import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SearchResult } from "@/lib/types";

function sanitizeIlike(q: string): string {
  return q.replace(/[%_,]/g, " ").trim();
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
  const raw = String(searchParams.get("q") ?? "").trim();
  const q = sanitizeIlike(raw.toLowerCase());

  if (q.length < 2) {
    return NextResponse.json({
      results: [],
      meta: { users: 0, contacts: 0, hint: "Type at least 2 characters" },
    });
  }

  const service = createServiceClient();
  const pattern = `%${q}%`;
  const results: SearchResult[] = [];
  const seenPersons = new Set<string>();

  const { data: byUsername, error: userErr1 } = await service
    .from("users")
    .select("id, person_id, username, display_name, avatar_url, bio")
    .eq("onboarding_completed", true)
    .ilike("username", pattern)
    .limit(20);

  const { data: byDisplay, error: userErr2 } = await service
    .from("users")
    .select("id, person_id, username, display_name, avatar_url, bio")
    .eq("onboarding_completed", true)
    .ilike("display_name", pattern)
    .limit(20);

  if (userErr1 || userErr2) {
    return NextResponse.json(
      { error: userErr1?.message ?? userErr2?.message },
      { status: 500 },
    );
  }

  for (const u of [...(byUsername ?? []), ...(byDisplay ?? [])]) {
    if (seenPersons.has(u.person_id)) continue;
    seenPersons.add(u.person_id);
    results.push({
      id: u.id,
      person_id: u.person_id,
      kind: "user",
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      bio: u.bio,
      claimed: true,
    });
  }

  const { data: contacts, error: contactErr } = await service
    .from("contact_imports")
    .select("id, person_id, contact_name")
    .eq("owner_user_id", user.id)
    .ilike("contact_name", pattern)
    .limit(20);

  if (contactErr) {
    return NextResponse.json({ error: contactErr.message }, { status: 500 });
  }

  const contactPersonIds = (contacts ?? []).map((c) => c.person_id);
  const { data: persons } =
    contactPersonIds.length > 0
      ? await service.from("persons").select("id, claimed").in("id", contactPersonIds)
      : { data: [] as { id: string; claimed: boolean }[] };

  const claimedMap = new Map((persons ?? []).map((p) => [p.id, p.claimed]));

  const { data: claimedUsers } =
    contactPersonIds.length > 0
      ? await service
          .from("users")
          .select("person_id, username, display_name, avatar_url")
          .in("person_id", contactPersonIds)
      : { data: [] as { person_id: string; username: string; display_name: string; avatar_url: string | null }[] };

  const userByPerson = new Map((claimedUsers ?? []).map((u) => [u.person_id, u]));

  let contactCount = 0;
  for (const c of contacts ?? []) {
    if (seenPersons.has(c.person_id)) continue;
    seenPersons.add(c.person_id);
    contactCount += 1;
    const claimed = claimedMap.get(c.person_id) ?? false;
    const u = userByPerson.get(c.person_id);
    if (claimed && u) {
      results.push({
        id: `contact-user-${c.id}`,
        person_id: c.person_id,
        kind: "user",
        username: u.username,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        claimed: true,
      });
    } else {
      results.push({
        id: `contact-${c.id}`,
        person_id: c.person_id,
        kind: "contact",
        display_name: c.contact_name,
        claimed: false,
      });
    }
  }

  const userCount = results.filter((r) => r.kind === "user").length;

  return NextResponse.json({
    results,
    meta: {
      users: userCount,
      contacts: contactCount,
    },
  });
}
