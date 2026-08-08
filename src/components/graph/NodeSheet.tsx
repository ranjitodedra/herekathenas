"use client";

import Link from "next/link";
import type { GraphNode } from "@/lib/types";

type Props = {
  node: GraphNode | null;
  onClose: () => void;
};

export function NodeSheet({ node, onClose }: Props) {
  if (!node) return null;

  const isPrivateContact = node.kind === "unclaimed" && node.from_import;
  const isAnonymous = node.kind === "unclaimed" && !node.from_import;

  const title = isAnonymous
    ? "Anonymous"
    : node.label || (node.kind === "unclaimed" ? "Anonymous" : "Unknown");

  return (
    <div className="panel fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl p-5 shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-ink/50">
            {node.kind === "self"
              ? "You"
              : node.kind === "claimed"
                ? "Public profile"
                : isPrivateContact
                  ? "Your contact"
                  : "Unclaimed"}
          </p>
          <h3 className="font-display text-2xl leading-tight">{title}</h3>
          {node.username ? (
            <p className="text-sm text-ink/60">@{node.username}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-sm text-ink/50 hover:bg-white/70"
        >
          Close
        </button>
      </div>

      {isPrivateContact ? (
        <p className="text-sm leading-relaxed text-ink/70">
          From your contacts (private). Only you see this name. Others see an empty node
          until they join and claim a public profile.
        </p>
      ) : isAnonymous ? (
        <p className="text-sm leading-relaxed text-ink/70">
          Empty node, no public name. This person hasn&apos;t claimed an account yet.
        </p>
      ) : (
        <>
          {node.bio ? <p className="mb-3 text-sm text-ink/70">{node.bio}</p> : null}
          {node.username ? (
            <Link href={`/profile/${node.username}`} className="btn-primary w-full text-sm">
              View profile
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
