const SKELETON_ROWS = ["one", "two", "three", "four"] as const;

export function VaultListSkeleton() {
  return (
    <ul className="space-y-1 p-1" aria-hidden>
      {SKELETON_ROWS.map((rowId) => (
        <li key={rowId} className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/80" />
          </div>
        </li>
      ))}
    </ul>
  );
}
