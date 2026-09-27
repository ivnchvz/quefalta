// Presentational pieces shared by the panel views, in the same visual language as the plan PDF:
// black background, rounded light/dark cards, outlined pills, circled arrows, light oversized numerals.

import { BRAND_MARK } from "@/lib/brandMark";
import type { Confidence } from "@/lib/engine";

export const fmt = (x: number) => x.toLocaleString("es-MX");
export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** QueFalta mark: Chihuahua state (currentColor) with a "?" cut in `markColor` (use the background color). */
export function BrandMark({ className = "h-4 w-4", markColor = "var(--bg)" }: { className?: string; markColor?: string }) {
  const m = BRAND_MARK;
  return (
    <svg viewBox={`0 0 ${m.size} ${m.size}`} className={className} aria-hidden>
      <path d={m.state} fill="currentColor" stroke="currentColor" strokeWidth={10} strokeLinejoin="round" />
      <path d={m.question} transform={`translate(${m.tx} ${m.ty}) scale(${m.s} ${-m.s})`} fill={markColor} />
    </svg>
  );
}

export function Logo({ className = "", markColor }: { className?: string; markColor?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${className}`}>
      <BrandMark className="h-5 w-5" markColor={markColor} />
      QueFalta
    </span>
  );
}

export function Pill({ children, variant = "dark" }: { children: React.ReactNode; variant?: "dark" | "light" | "filled" }) {
  const style =
    variant === "filled"
      ? "bg-[#e4e6e3] text-ink border-transparent"
      : variant === "light"
        ? "border-ink text-ink"
        : "border-on-dark text-on-dark";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-normal uppercase tracking-[0.08em] ${style}`}>
      {children}
    </span>
  );
}

const ARROWS = {
  "down-left": "M16 8 8 16M8 16V10M8 16h6",
  "down-right": "M8 8l8 8M16 16v-6M16 16h-6",
  left: "M18 12H6M6 12l5-5M6 12l5 5",
} as const;

export function ArrowCircle({ dir = "down-left", size = "h-9 w-9", className = "" }: { dir?: keyof typeof ARROWS; size?: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full border ${size} ${className}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={ARROWS[dir]} />
      </svg>
    </span>
  );
}

export function CheckBadge() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

/** Tile like the PDF's fact cards: label + check badge on top, number in a white inner box. */
export function FactTile({ label, value, tone = "a" }: { label: string; value: string; tone?: "a" | "b" }) {
  return (
    <div className={`rounded-2xl p-2 ${tone === "a" ? "bg-tile-a text-ink" : "bg-tile-b text-white"}`}>
      <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5 text-xs">
        {label}
        <CheckBadge />
      </div>
      <div className="rounded-xl bg-white py-2 text-center text-2xl font-light text-ink">{value}</div>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-light leading-tight text-ink">{value}</div>
      <div className="text-[10px] text-ink-soft">{label}</div>
    </div>
  );
}

const DOT = { alta: "bg-ink", media: "bg-headline-gray", baja: "bg-tile-b" } as const;

export function ConfidenceDot({ level }: { level: Confidence }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-ink-soft" title={`Confianza ${level} del modelo para este giro`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[level]}`} />
      confianza {level}
    </span>
  );
}

/** Bar of how many businesses exist, with a tick where the model expects the count to be. */
export function GapBar({ actual, expected }: { actual: number; expected: number }) {
  const max = Math.max(actual, expected, 1) * 1.1;
  const over = actual > expected;
  return (
    <div className="relative mt-2 h-1 w-full rounded-full bg-tile-a">
      <div className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-headline-gray" : "bg-ink"}`} style={{ width: `${(actual / max) * 100}%` }} />
      <div className="absolute -top-1 h-3 w-px bg-ink" style={{ left: `${(expected / max) * 100}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 rounded-full border border-white/15 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 rounded-full px-2 py-1.5 text-[11px] transition ${
            active === t.id ? "bg-on-dark text-ink" : "text-on-dark-soft hover:text-on-dark"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Dark collapsible card with a pill label and a circled arrow. */
export function Collapsible({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="group rounded-3xl bg-card-dark p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <span className="flex items-center gap-2">
          <Pill>{label}</Pill>
          {count !== undefined && <span className="text-sm font-light text-on-dark-soft">{String(count).padStart(2, "0")}</span>}
        </span>
        <ArrowCircle dir="down-right" size="h-7 w-7" className="border-on-dark-soft text-on-dark transition group-open:rotate-90" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
