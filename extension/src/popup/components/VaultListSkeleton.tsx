const SKELETON_ROWS = ["one", "two", "three", "four", "five", "six"] as const;

export function VaultListSkeleton() {
  return (
    <ul className="space-y-1 p-2" aria-hidden>
      {SKELETON_ROWS.map((rowId) => (
        <li key={rowId} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted/80" />
          </div>
        </li>
      ))}
    </ul>
  );
}
