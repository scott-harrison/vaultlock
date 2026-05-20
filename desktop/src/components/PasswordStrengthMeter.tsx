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
    <div className="strength-meter" aria-live="polite">
      <div className="strength-bars" aria-hidden>
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className={`strength-bar ${index <= strength.score ? "strength-bar-active" : ""} ${
              strength.isStrongEnough ? "strength-bar-ok" : ""
            }`}
          />
        ))}
      </div>
      <p className={`strength-label ${strength.isStrongEnough ? "strength-ok" : ""}`}>
        {label} — {strength.feedback}
      </p>
    </div>
  );
}
