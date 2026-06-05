import { AuthFeedback } from "./AuthFeedback";

interface FillRequestBannerProps {
  hostname: string;
}

export function FillRequestBanner({ hostname }: FillRequestBannerProps) {
  return (
    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
      <p className="text-xs font-medium">Login form detected on {hostname}</p>
      <AuthFeedback variant="warning" className="mt-1">
        Choose a matching login below and tap Fill.
      </AuthFeedback>
    </div>
  );
}
