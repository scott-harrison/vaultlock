import { AuthFeedback } from "./AuthFeedback";

interface FillRequestBannerProps {
  hostname: string;
  matchCount: number;
  totalLoginCount: number;
}

export function FillRequestBanner({
  hostname,
  matchCount,
  totalLoginCount,
}: FillRequestBannerProps) {
  const title =
    matchCount === 1 ? `1 login matches ${hostname}` : `${matchCount} logins match ${hostname}`;

  const guidance =
    matchCount > 0
      ? "Choose a login below and tap Fill."
      : totalLoginCount > 0
        ? "Save a login for this site in VaultLock, or pick any login without a URL from your vault."
        : "Add a login to your vault, then try again.";

  return (
    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
      <p className="text-sm font-medium">
        {matchCount > 0 ? title : `No saved logins match ${hostname}`}
      </p>
      <AuthFeedback variant="warning" className="mt-1">
        {guidance}
      </AuthFeedback>
    </div>
  );
}
