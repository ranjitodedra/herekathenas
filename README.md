<p align="center">
  <img src="./public/logo.png" alt="Lock-In logo" width="150" style="border-radius:90px" />
</p>

<h1 align="center">HereKathenas</h1>

> See how you're connected.

HereKathenas is a people relationship graph. Import contacts, claim identities by phone number, explore your network, and find shortest paths between users.

## Tech Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript + Tailwind |
| Hosting | **Zerops** Node.js 22 (standalone SSR) |
| Backend | Supabase (Auth, Postgres, RLS, Storage) |
| Graph UI | Cytoscape.js |
| Auth | Email magic link (no SMS cost). Phone hashed at onboarding for matching |
| Pathfinding | BFS over `connections` |


## Quick start (local)

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

**hosted project**

1. Create a project at [supabase.com](https://supabase.com)
2. Put URL + keys in `.env.local`
3. `supabase link --project-ref YOUR_REF && supabase db push`
4. Enable Email auth; add `http://localhost:3000/auth/callback`

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000

## User flows

1. **Sign in** with email magic link  
2. **Onboarding** — name, username, phone (hashed for matching)  
3. **Import** — CSV (`name,phone`), Contact Picker (Chromium), or manual entry  
4. **Dashboard** — interactive ego graph (claimed / unclaimed / you)  
5. **Find Connection** — search users → BFS shortest path  
6. **Profile** — bio, social links, avatar, delete account  

## Privacy

- Raw phone numbers are **not** stored. Only `SHA-256(pepper:E.164)` lives in `persons.phone_hash`.
- Contact display names live in `contact_imports` and are **owner-only** via RLS.
- Strangers see unclaimed nodes as anonymous placeholders.
- Claiming: when a new user onboards with a matching phone hash, they take over that node.