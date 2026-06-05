import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { PasswordGeneratorPanel } from "@/components/vault/PasswordGeneratorPanel";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface LoginPasswordFieldProps {
  id: string;
  password: string;
  contextHints: string[];
  disabled?: boolean;
  onPasswordChange: (password: string) => void;
  onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function LoginPasswordField({
  id,
  password,
  contextHints,
  disabled = false,
  onPasswordChange,
  onInputChange,
}: LoginPasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-medium leading-none">
            Password
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={disabled}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? (
              <>
                <EyeOff className="size-3.5" aria-hidden />
                Hide
              </>
            ) : (
              <>
                <Eye className="size-3.5" aria-hidden />
                Show
              </>
            )}
          </Button>
        </div>
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          disabled={disabled}
          onChange={onInputChange}
        />
      </div>

      <PasswordGeneratorPanel
        password={password}
        contextHints={contextHints}
        disabled={disabled}
        onPasswordChange={onPasswordChange}
      />
    </div>
  );
}
