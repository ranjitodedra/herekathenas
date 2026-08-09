"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function complete(skipImport: boolean) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, username, skipImport }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.push(data.next ?? "/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <BrandMark size="md" />

      {step === 1 ? (
        <div className="mt-8">
          <h1 className="font-display text-4xl leading-tight">
            Your network already exists.
          </h1>
          <p className="mt-3 text-ink/65">
            We&apos;ll help you map the people you already know. No feed, no posts.
          </p>
          <button type="button" className="btn-primary mt-8" onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-8 space-y-4">
          <h1 className="font-display text-4xl">What&apos;s your name?</h1>
          <input
            className="input-field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ranjit"
          />
          <label className="block text-sm">
            Username
            <input
              className="input-field mt-1.5"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="ranjit"
            />
          </label>
          {error ? <p className="text-sm text-[var(--coral-deep)]">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={loading || displayName.trim().length < 2 || username.trim().length < 3}
              onClick={() => complete(false)}
            >
              {loading ? "Saving…" : "Continue to import"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={loading || displayName.trim().length < 2 || username.trim().length < 3}
              onClick={() => complete(true)}
            >
              Skip import
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
