interface AuthFieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

export function AuthField({ label, htmlFor, children }: AuthFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
