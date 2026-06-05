interface AuthFieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

export function AuthField({ label, htmlFor, children }: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
