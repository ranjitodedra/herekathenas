"use client";

import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email for a sign-in link. (Local Supabase: open Inbucket at http://127.0.0.1:54324)");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <BrandMark size="md" className="mb-8" />
      <h1 className="font-display text-4xl leading-tight">Sign in</h1>
      <p className="mt-2 text-sm text-ink/65">
        Free experiment stack uses email magic links (no SMS cost). Phone numbers are
        collected at onboarding for contact matching.
      </p>

      {status === "sent" ? (
        <div className="panel mt-8 rounded-2xl p-5 text-sm leading-relaxed">{message}</div>
      ) : (
        <form onSubmit={sendMagicLink} className="mt-8 space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field mt-1.5"
              placeholder="you@example.com"
            />
          </label>
          {status === "error" ? (
            <p className="text-sm text-[var(--coral-deep)]">{message}</p>
          ) : null}
          <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
            {status === "loading" ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}
    </div>
  );
}
