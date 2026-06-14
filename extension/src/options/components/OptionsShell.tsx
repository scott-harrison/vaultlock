interface OptionsShellProps {
  children: React.ReactNode;
}

export function OptionsShell({ children }: OptionsShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl space-y-8 p-6 lg:p-8">{children}</div>
    </div>
  );
}
