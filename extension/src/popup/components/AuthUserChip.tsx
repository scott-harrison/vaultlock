function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  if (local.length >= 2) {
    return local.slice(0, 2).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}

interface AuthUserChipProps {
  email: string;
}

export function AuthUserChip({ email }: AuthUserChipProps) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary"
        aria-hidden
      >
        {initialsFromEmail(email)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{email}</p>
        <p className="text-xs text-muted-foreground">Signed in</p>
      </div>
    </div>
  );
}
