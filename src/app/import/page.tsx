"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { AppShell } from "@/components/layout/AppShell";
import type { UserProfile } from "@/lib/types";

type Row = { name: string; phone: string };

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{
    imported: number;
    matched: number;
    created: number;
    skipped: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (!d.profile) router.replace("/onboarding");
        else setProfile(d.profile);
      });
  }, [router]);

  function onFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const next: Row[] = [];
        for (const row of parsed.data) {
          const name =
            row.name || row.Name || row.full_name || row["Full Name"] || row.first_name || "";
          const phone =
            row.phone || row.Phone || row.mobile || row.Mobile || row.number || row.Number || "";
          if (name && phone) next.push({ name: String(name).trim(), phone: String(phone).trim() });
        }
        setRows(next);
        setStatus(`Parsed ${next.length} contacts from CSV`);
        setResult(null);
      },
    });
  }

  function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualName.trim() || !manualPhone.trim()) return;
    setRows((prev) => [...prev, { name: manualName.trim(), phone: manualPhone.trim() }]);
    setManualName("");
    setManualPhone("");
  }

  async function importContacts() {
    if (!rows.length) return;
    setLoading(true);
    setStatus("");
    const res = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: rows }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(data.error ?? "Import failed");
      return;
    }
    setResult({
      imported: data.imported,
      matched: data.matched,
      created: data.created,
      skipped: data.skipped,
    });
    setStatus("Import complete");
  }

  async function clearImports() {
    if (!confirm("Delete all imported contacts and their edges from your account?")) return;
    const res = await fetch("/api/contacts/delete", { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setStatus(`Deleted ${data.deleted} imported contacts`);
      setRows([]);
      setResult(null);
    } else {
      setStatus(data.error ?? "Delete failed");
    }
  }

  return (
    <AppShell username={profile?.username}>
      <h1 className="font-display text-4xl tracking-tight">Build your network</h1>
      <p className="mt-2 max-w-xl text-sm text-ink/65">
        Import contacts to see your existing network. Contact names stay private to you.
        Phone numbers are hashed, never shown publicly.
      </p>

      <div className="panel mt-6 max-w-2xl space-y-4 rounded-2xl p-5">
        <p className="text-sm font-medium">CSV upload</p>
        <p className="text-xs text-ink/55">
          Columns: <code>name,phone</code>. Download the sample below. After import, search for
          Casey Morgan (verified demo via Alex Rivera, 2 steps away) to see how people are connected.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose CSV file
          </button>
          <a href="/sample-contacts.csv" download className="btn-secondary text-sm">
            Download sample CSV
          </a>
        </div>
        {fileName ? (
          <p className="text-sm text-ink/70">
            Selected: <span className="font-medium text-ink">{fileName}</span>
          </p>
        ) : (
          <p className="text-xs text-ink/50">No file selected yet</p>
        )}
      </div>

      <form onSubmit={addManual} className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className="input-field"
          placeholder="Name"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
        />
        <input
          className="input-field"
          placeholder="+1 555 0100"
          value={manualPhone}
          onChange={(e) => setManualPhone(e.target.value)}
        />
        <button type="submit" className="btn-secondary">
          Add
        </button>
      </form>

      {rows.length ? (
        <div className="panel mt-6 max-w-2xl overflow-hidden rounded-2xl">
          <div className="border-b border-[var(--line)] px-4 py-3 text-sm font-medium">
            Ready to import: {rows.length}
          </div>
          <ul className="max-h-56 overflow-auto text-sm">
            {rows.slice(0, 50).map((r, i) => (
              <li
                key={`${r.phone}-${i}`}
                className="flex justify-between gap-3 border-b border-[var(--line)] px-4 py-2"
              >
                <span>{r.name}</span>
                <span className="text-ink/50">{r.phone}</span>
              </li>
            ))}
          </ul>
          {rows.length > 50 ? (
            <p className="px-4 py-2 text-xs text-ink/50">…and {rows.length - 50} more</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={!rows.length || loading}
          onClick={importContacts}
        >
          {loading ? "Importing…" : "Import contacts"}
        </button>
        <button type="button" className="btn-secondary" onClick={clearImports}>
          Delete my imports
        </button>
        {result ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/dashboard")}
          >
            View graph
          </button>
        ) : null}
      </div>

      {status ? <p className="mt-4 text-sm text-ink/70">{status}</p> : null}
      {result ? (
        <div className="panel mt-4 max-w-md rounded-2xl p-4 text-sm">
          <p>Imported: {result.imported}</p>
          <p>Matched existing users: {result.matched}</p>
          <p>New unclaimed nodes: {result.created}</p>
          <p>Skipped: {result.skipped}</p>
        </div>
      ) : null}
    </AppShell>
  );
}
