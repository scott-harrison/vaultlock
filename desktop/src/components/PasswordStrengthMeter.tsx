interface PasswordStrengthMeterProps {
  strength: {
    score: number;
    feedback: string;
    isStrongEnough: boolean;
  };
}

const SCORE_LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];

export function PasswordStrengthMeter({ strength }: PasswordStrengthMeterProps) {
  const label = SCORE_LABELS[strength.score] ?? "Very weak";

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= strength.score
                ? strength.isStrongEnough
                  ? "bg-primary"
                  : "bg-amber-500"
                : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p
        className={`text-xs ${strength.isStrongEnough ? "text-primary" : "text-muted-foreground"}`}
      >
        {label} — {strength.feedback}
      </p>
    </div>
  );
}
