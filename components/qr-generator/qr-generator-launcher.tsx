"use client";

import { useState } from "react";
import { QrGeneratorDialog } from "@/components/qr-generator/qr-generator-dialog";
import { Button } from "@/components/ui/button";
import type { LifeGrid } from "@/lib/game-of-life/game-of-life";

type Props = {
  onGenerate: (seed: LifeGrid, qrValue: string) => void;
  onOpenChange?: (open: boolean) => void;
};

export function QrGeneratorLauncher({ onGenerate, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <>
      {!open && (
        <Button
          type="button"
          onClick={() => handleOpenChange(true)}
          variant="aurora"
          className="h-auto px-5 py-2.5 text-sm font-semibold"
        >
          Generate QR
        </Button>
      )}

      <QrGeneratorDialog
        open={open}
        onGenerate={(seed, qrValue) => {
          handleOpenChange(false);
          onGenerate(seed, qrValue);
        }}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}
