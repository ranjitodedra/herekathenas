import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const loggedIn = Boolean(user);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, transparent 0 1px, rgba(12,26,31,0.08) 1px 2px), radial-gradient(circle at 70% 60%, transparent 0 1px, rgba(12,26,31,0.06) 1px 2px)",
          backgroundSize: "48px 48px, 72px 72px",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <BrandMark size="md" />
        {loggedIn ? (
          <Link href="/dashboard" className="btn-secondary text-sm">
            Continue
          </Link>
        ) : (
          <Link href="/auth" className="btn-secondary text-sm">
            Sign in
          </Link>
        )}
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-20 pt-10 lg:flex-row lg:items-center lg:gap-12 lg:pb-24">
        <div className="min-w-0 flex-1">
          <Link
            href="/"
            className="font-display mb-4 block text-5xl leading-[0.95] tracking-tight sm:text-7xl md:text-8xl"
          >
            Everyone is Here
          </Link>
          <h1 className="max-w-xl text-xl text-ink/80 sm:text-2xl">
            See how you&apos;re connected.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink/65">
            Import your contacts. Watch anonymous nodes become real people. Find the
            shortest path to anyone in your network.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {loggedIn ? (
              <Link href="/dashboard" className="btn-primary">
                Continue
              </Link>
            ) : (
              <Link href="/auth" className="btn-primary">
                Build your network
              </Link>
            )}
            <a href="#how" className="btn-secondary">
              How it works
            </a>
          </div>
        </div>

        {/* Triangle: You & Someone base, Friend raised */}
        <div
          aria-hidden
          className="relative mx-auto mt-14 h-72 w-full max-w-md shrink-0 sm:h-80 sm:max-w-lg lg:mx-0 lg:mt-0 lg:h-[22rem] lg:w-[min(100%,28rem)] lg:max-w-none"
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 320 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M70 178 L160 58 L250 178"
              stroke="rgba(12,26,31,0.28)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M70 178 L250 178"
              stroke="rgba(12,26,31,0.18)"
              strokeWidth="2"
              strokeDasharray="5 6"
            />
          </svg>

          <div className="absolute top-[10%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
            <span className="text-sm font-medium text-ink/65 sm:text-base">Friend</span>
            <span className="h-12 w-12 rounded-full bg-[var(--teal)] ring-2 ring-ink/80 sm:h-14 sm:w-14" />
          </div>
          <div className="absolute bottom-[6%] left-[4%] flex flex-col items-center gap-2 sm:left-[8%]">
            <span className="h-12 w-12 rounded-full bg-[var(--coral)] ring-2 ring-ink/80 sm:h-14 sm:w-14" />
            <span className="text-sm font-medium text-ink/65 sm:text-base">You</span>
          </div>
          <div className="absolute right-[4%] bottom-[6%] flex flex-col items-center gap-2 sm:right-[8%]">
            <span className="h-12 w-12 rounded-full bg-[var(--mist)] ring-2 ring-ink/80 sm:h-14 sm:w-14" />
            <span className="text-sm font-medium text-ink/65 sm:text-base">Someone</span>
          </div>
        </div>
      </section>

      <section id="how" className="relative z-10 border-t border-[var(--line)] bg-white/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-3">
          {[
            {
              title: "Import contacts",
              body: "Upload a CSV of names and phones. We hash numbers, never expose them publicly.",
            },
            {
              title: "Claim identities",
              body: "When someone joins with a matching phone, their anonymous node becomes a real profile.",
            },
            {
              title: "Find paths",
              body: "Search for a person and see how many steps away they are, and who sits in between.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="font-display text-2xl">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
