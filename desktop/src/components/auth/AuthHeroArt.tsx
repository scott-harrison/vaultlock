import { Lock } from "lucide-react";

export function AuthHeroArt() {
  return (
    <div className="relative flex size-full max-h-[min(32rem,70vh)] max-w-[min(32rem,70vh)] items-center justify-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 25%, transparent) 0%, transparent 55%), repeating-radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--foreground) 6%, transparent) 0 1px, transparent 1px 24px)",
        }}
      />

      <div className="relative aspect-square w-full rounded-[2rem] bg-card p-[3px] shadow-2xl">
        <div
          className="absolute inset-0 rounded-[2rem] opacity-80"
          aria-hidden
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--chart-1) 80%, transparent), color-mix(in oklch, var(--chart-3) 80%, transparent))",
          }}
        />
        <div className="relative flex h-full flex-col items-center justify-center rounded-[calc(2rem-3px)] bg-background/95 p-10">
          <div className="absolute inset-8 rounded-full border border-border/40" aria-hidden />
          <div className="absolute inset-14 rounded-full border border-border/25" aria-hidden />
          <div className="absolute inset-20 rounded-full border border-border/15" aria-hidden />

          <div className="relative flex size-28 items-center justify-center rounded-full border-2 border-border bg-muted/50 shadow-inner">
            <div className="absolute inset-2 rounded-full border border-border/60" aria-hidden />
            <Lock className="size-10 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
