import { NextResponse } from "next/server";
import { phoneAuthEmail, phoneAuthPassword } from "@/lib/phone-auth";
import { normalizeAndHashPhone } from "@/lib/phone";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function findAuthUserIdByEmail(
  service: ReturnType<typeof createServiceClient>,
  email: string,
): Promise<string | null> {
  // Paginate lightly; fine for hackathon scale.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phoneRaw = String((body as { phone?: string }).phone ?? "").trim();
  const phone = normalizeAndHashPhone(phoneRaw);
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid phone number with country code (e.g. +1 519 123 4567)" },
      { status: 400 },
    );
  }

  const email = phoneAuthEmail(phone.hash);
  const password = phoneAuthPassword(phone.e164);
  const service = createServiceClient();
  const supabase = await createClient();

  const meta = {
    phone_hash: phone.hash,
    auth_method: "phone",
  };

  // Existing account: sign in. New account: create (confirmed, no email sent) then sign in.
  let { error: signError } = await supabase.auth.signInWithPassword({ email, password });

  if (signError) {
    const { error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    });

    if (createError) {
      const existingId = await findAuthUserIdByEmail(service, email);
      if (!existingId) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      // Align password/metadata if account already existed (e.g. older runs).
      const { error: updateError } = await service.auth.admin.updateUserById(existingId, {
        password,
        email_confirm: true,
        user_metadata: meta,
      });
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const retry = await supabase.auth.signInWithPassword({ email, password });
    signError = retry.error;
  }

  if (signError) {
    return NextResponse.json({ error: signError.message }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await service.from("users").select("onboarding_completed").eq("id", user.id).maybeSingle()
    : { data: null };

  return NextResponse.json({
    ok: true,
    next: profile?.onboarding_completed ? "/dashboard" : "/onboarding",
  });
}
