"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";

export default function AuthPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function signInWithPhone(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/auth/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "Could not sign in");
      return;
    }

    router.push(data.next ?? "/onboarding");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <BrandMark size="md" className="mb-8" />
      <h1 className="font-display text-4xl leading-tight">Sign in</h1>
      <p className="mt-2 text-sm text-ink/65">
        Use your phone number to create an account or sign back in. We store a salted hash for
        contact matching, not your raw number. No email or SMS codes.
      </p>

      <form onSubmit={signInWithPhone} className="mt-8 space-y-4">
        <label className="block text-sm font-medium">
          Phone number
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-field mt-1.5"
            placeholder="+1 519 123 4567"
            autoComplete="tel"
          />
        </label>
        {status === "error" ? (
          <p className="text-sm text-[var(--coral-deep)]">{message}</p>
        ) : null}
        <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
          {status === "loading" ? "Signing in…" : "Continue with phone"}
        </button>
      </form>
    </div>
  );
}
