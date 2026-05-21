import { AuthBrand } from "@/components/auth/AuthBrand";
import { AuthHeroArt } from "@/components/auth/AuthHeroArt";
import packageJson from "../../../package.json";

interface AuthLayoutProps {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

export function AuthLayout({ children, headerRight }: AuthLayoutProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden bg-background">
      {headerRight && (
        <div className="absolute top-6 right-6 z-10 lg:top-8 lg:right-8">{headerRight}</div>
      )}

      <div className="flex w-full flex-col lg:max-w-xl lg:shrink-0 xl:max-w-lg">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-8 lg:px-12 lg:py-10">
          <AuthBrand />

          <div className="flex min-h-0 flex-1 flex-col justify-center py-10">
            <div className="mx-auto w-full max-w-sm space-y-6">{children}</div>
          </div>

          <p className="text-xs text-muted-foreground">Version {packageJson.version}</p>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 items-center justify-center bg-muted/15 p-10 lg:flex">
        <AuthHeroArt />
      </div>
    </div>
  );
}
