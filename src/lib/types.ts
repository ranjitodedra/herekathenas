export type Person = {
  id: string;
  phone_hash: string | null;
  claimed: boolean;
  created_at: string;
  updated_at: string;
};

export type UserProfile = {
  id: string;
  person_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type ExternalProfile = {
  id: string;
  user_id: string;
  platform: string;
  username: string | null;
  url: string;
  created_at: string;
};

export type ContactImport = {
  id: string;
  owner_user_id: string;
  person_id: string;
  contact_name: string;
  created_at: string;
};

export type GraphNode = {
  id: string;
  label: string;
  kind: "self" | "claimed" | "unclaimed";
  username?: string;
  avatar_url?: string | null;
  bio?: string | null;
  /** True when this node comes from the viewer's own contact import (private name). */
  from_import?: boolean;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type PathHop = {
  person_id: string;
  label: string;
  kind: "self" | "claimed" | "unclaimed";
  username?: string;
  avatar_url?: string | null;
  from_import?: boolean;
};

export type SearchResult = {
  id: string;
  person_id: string;
  display_name: string;
  kind: "user" | "contact";
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  claimed?: boolean;
};
