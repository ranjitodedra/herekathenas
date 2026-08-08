import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { normalizeAndHashPhone, orderedPair } from "@/lib/phone";

type ImportRow = { name: string; phone: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, person_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  }

  const body = await request.json();
  const contacts = (body.contacts ?? []) as ImportRow[];

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
  }

  if (contacts.length > 2000) {
    return NextResponse.json({ error: "Max 2000 contacts per import" }, { status: 400 });
  }

  let imported = 0;
  let matched = 0;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of contacts) {
    const name = String(row.name ?? "").trim();
    const phoneRaw = String(row.phone ?? "").trim();
    if (!name || !phoneRaw) {
      skipped += 1;
      continue;
    }

    const phone = normalizeAndHashPhone(phoneRaw);
    if (!phone) {
      skipped += 1;
      continue;
    }

    // Don't create a self-loop
    const { data: selfPerson } = await service
      .from("persons")
      .select("phone_hash")
      .eq("id", profile.person_id)
      .single();

    if (selfPerson?.phone_hash === phone.hash) {
      skipped += 1;
      continue;
    }

    let personId: string;
    let wasClaimed = false;

    const { data: existing } = await service
      .from("persons")
      .select("id, claimed")
      .eq("phone_hash", phone.hash)
      .maybeSingle();

    if (existing) {
      personId = existing.id;
      wasClaimed = existing.claimed;
    } else {
      const { data: createdPerson, error: createError } = await service
        .from("persons")
        .insert({ phone_hash: phone.hash, claimed: false })
        .select("id")
        .single();

      if (createError || !createdPerson) {
        errors.push(`${name}: ${createError?.message ?? "create failed"}`);
        continue;
      }
      personId = createdPerson.id;
      created += 1;
    }

    if (wasClaimed) matched += 1;

    const [a, b] = orderedPair(profile.person_id, personId);
    const { error: edgeError } = await service.from("connections").upsert(
      {
        person_a_id: a,
        person_b_id: b,
        source: "contact_import",
      },
      { onConflict: "person_a_id,person_b_id", ignoreDuplicates: true },
    );

    if (edgeError) {
      errors.push(`${name}: ${edgeError.message}`);
      continue;
    }

    await service.from("contact_imports").upsert(
      {
        owner_user_id: user.id,
        person_id: personId,
        contact_name: name,
      },
      { onConflict: "owner_user_id,person_id" },
    );

    imported += 1;
  }

  await service.from("events").insert({
    user_id: user.id,
    event_name: "contacts_imported",
    metadata: { imported, matched, created, skipped },
  });

  return NextResponse.json({
    ok: true,
    imported,
    matched,
    created,
    skipped,
    errors: errors.slice(0, 10),
  });
}
