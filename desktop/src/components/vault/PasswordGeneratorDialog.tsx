import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordGeneratorPanel } from "@/components/vault/PasswordGeneratorPanel";
import { DEFAULT_PASSWORD_GENERATOR_OPTIONS, generatePassword } from "@vaultlock/shared";
import { useState } from "react";

interface PasswordGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseInNewLogin?: (password: string) => void;
}

export function PasswordGeneratorDialog({
  open,
  onOpenChange,
  onUseInNewLogin,
}: PasswordGeneratorDialogProps) {
  const [password, setPassword] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    if (open) {
      setPassword(generatePassword(DEFAULT_PASSWORD_GENERATOR_OPTIONS));
    }
    setWasOpen(open);
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const handleUseInNewLogin = () => {
    if (!password || !onUseInNewLogin) {
      return;
    }
    onUseInNewLogin(password);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate password</DialogTitle>
          <DialogDescription>
            Create a random password, copy it, or save it into a new login item.
          </DialogDescription>
        </DialogHeader>

        {password && (
          <Input
            readOnly
            value={password}
            className="font-mono text-sm"
            aria-label="Generated password"
          />
        )}

        <PasswordGeneratorPanel
          password={password}
          contextHints={[]}
          onPasswordChange={setPassword}
        />

        {onUseInNewLogin && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" disabled={!password} onClick={handleUseInNewLogin}>
              Use in new login
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
