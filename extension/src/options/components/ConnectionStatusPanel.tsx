import { Badge } from "@vaultlock/ui/components/ui/badge";
import { cn } from "@vaultlock/ui/lib/utils";
import type { LastConnectionStatus } from "../../lib/storage";
import type { TestResult } from "../hooks/useServerOptions";

interface ConnectionStatusPanelProps {
  normalizedUrl: string;
  currentTestResult: TestResult;
  lastStatus: LastConnectionStatus | null;
}

function formatStatusTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConnectionStatusPanel({
  normalizedUrl,
  currentTestResult,
  lastStatus,
}: ConnectionStatusPanelProps) {
  const badge = (() => {
    if (currentTestResult === "success") {
      return { label: "Connected (just tested)", variant: "default" as const };
    }
    if (currentTestResult === "error") {
      return { label: "Connection failed (just tested)", variant: "destructive" as const };
    }
    if (lastStatus?.success) {
      return {
        label: `Connected · ${formatStatusTime(lastStatus.timestamp)}`,
        variant: "secondary" as const,
      };
    }
    if (lastStatus) {
      return {
        label: `Failed · ${formatStatusTime(lastStatus.timestamp)}`,
        variant: "destructive" as const,
      };
    }
    return { label: "Not tested yet", variant: "outline" as const };
  })();

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Connection status</h3>
        <Badge
          variant={badge.variant}
          className={cn(
            badge.variant === "default" && "bg-primary/15 text-primary hover:bg-primary/15",
          )}
        >
          {badge.label}
        </Badge>
      </div>
      {normalizedUrl ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Normalized URL:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
            {normalizedUrl}
          </code>
        </p>
      ) : null}
    </div>
  );
}
