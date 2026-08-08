import Link from "next/link";

type BrandMarkProps = {
  /** Text size for the wordmark. */
  size?: "sm" | "md" | "lg" | "hero";
  href?: string;
  className?: string;
};

const sizeMap = {
  sm: { img: 22, text: "text-xl" },
  md: { img: 28, text: "text-2xl" },
  lg: { img: 32, text: "text-2xl" },
  hero: { img: 48, text: "text-5xl sm:text-7xl md:text-8xl" },
} as const;

export function BrandMark({
  size = "md",
  href = "/",
  className = "",
}: BrandMarkProps) {
  const s = sizeMap[size];
  return (
    <Link
      href={href}
      className={`font-display inline-flex items-center gap-2 tracking-tight ${s.text} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-favicon.svg"
        alt=""
        width={s.img}
        height={s.img}
        className="shrink-0"
        style={
          size === "hero"
            ? { width: "0.55em", height: "0.55em" }
            : undefined
        }
      />
      <span>Here Kathenas</span>
    </Link>
  );
}
