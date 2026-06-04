import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { Button } from "@/components/ui/button";
import { evaluateVaultPasswordStrength } from "@/lib/passwordStrength";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PASSWORD_GENERATOR_OPTIONS,
  MAX_GENERATED_LENGTH,
  MIN_GENERATED_LENGTH,
  type PasswordGeneratorOptions,
  generatePassword,
} from "@vaultlock/shared";
import { Copy, RefreshCw } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

interface PasswordGeneratorPanelProps {
  password: string;
  contextHints: string[];
  disabled?: boolean;
  onPasswordChange: (password: string) => void;
}

function GeneratorToggle({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="size-3.5 rounded border-input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

export function PasswordGeneratorPanel({
  password,
  contextHints,
  disabled = false,
  onPasswordChange,
}: PasswordGeneratorPanelProps) {
  const panelId = useId();
  const [length, setLength] = useState(DEFAULT_PASSWORD_GENERATOR_OPTIONS.length);
  const [uppercase, setUppercase] = useState(DEFAULT_PASSWORD_GENERATOR_OPTIONS.uppercase);
  const [numbers, setNumbers] = useState(DEFAULT_PASSWORD_GENERATOR_OPTIONS.numbers);
  const [symbols, setSymbols] = useState(DEFAULT_PASSWORD_GENERATOR_OPTIONS.symbols);

  const strength = useMemo(
    () => evaluateVaultPasswordStrength(password, contextHints),
    [password, contextHints],
  );

  const applyGenerated = (options: PasswordGeneratorOptions) => {
    onPasswordChange(generatePassword(options));
  };

  const handleGenerate = () => {
    applyGenerated({ length, uppercase, numbers, symbols });
  };

  const handleCopy = () => {
    if (!password) {
      return;
    }
    void navigator.clipboard.writeText(password).then(() => {
      toast.success("Password copied to clipboard.");
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Password generator</span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={disabled || !password}
            onClick={handleCopy}
          >
            <Copy className="size-3.5" aria-hidden />
            Copy
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={disabled}
            onClick={handleGenerate}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Generate
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <label htmlFor={`${panelId}-length`} className="font-medium text-muted-foreground">
            Length
          </label>
          <span className="tabular-nums text-foreground">{length}</span>
        </div>
        <input
          id={`${panelId}-length`}
          type="range"
          min={MIN_GENERATED_LENGTH}
          max={MAX_GENERATED_LENGTH}
          value={length}
          disabled={disabled}
          className="h-2 w-full cursor-pointer accent-primary"
          onChange={(event) => setLength(Number(event.target.value))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <GeneratorToggle
          id={`${panelId}-uppercase`}
          label="Uppercase"
          checked={uppercase}
          disabled={disabled}
          onChange={setUppercase}
        />
        <GeneratorToggle
          id={`${panelId}-numbers`}
          label="Numbers"
          checked={numbers}
          disabled={disabled}
          onChange={setNumbers}
        />
        <GeneratorToggle
          id={`${panelId}-symbols`}
          label="Symbols"
          checked={symbols}
          disabled={disabled}
          onChange={setSymbols}
        />
      </div>

      {password && <PasswordStrengthMeter strength={strength} />}
    </div>
  );
}
