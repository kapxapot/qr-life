"use client";

import { useDeferredValue, useRef, useState } from "react";
import { QrGeneratorPreview } from "@/components/qr-generator-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { LifeGrid } from "@/lib/game-of-life";
import { createQrSeedFromText } from "@/lib/qr-generator";

type Props = {
  onGenerate: (seed: LifeGrid, qrValue: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type PreviewState = {
  error: string | null;
  seed: LifeGrid | null;
};

function getPreviewState(text: string): PreviewState {
  if (text.length === 0) {
    return {
      error: null,
      seed: null,
    };
  }

  try {
    return {
      error: null,
      seed: createQrSeedFromText(text),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The QR preview couldn't be generated.",
      seed: null,
    };
  }
}

export function QrGeneratorDialog({ onGenerate, onOpenChange, open }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewText = useDeferredValue(text);
  const previewState = getPreviewState(previewText);
  const submitState = getPreviewState(text);
  const canGenerate =
    text.length > 0 && submitState.error === null && submitState.seed !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden border border-cyan-300/14 bg-linear-[180deg,rgba(10,18,34,0.98),rgba(5,10,20,0.98)] p-0 text-white shadow-[0_32px_90px_-48px_rgba(34,211,238,0.5)] sm:max-w-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        showCloseButton
      >
        <form
          className="space-y-4 p-4 lg:space-y-6 lg:p-6"
          onSubmit={(event) => {
            event.preventDefault();

            if (!canGenerate || !submitState.seed) {
              return;
            }

            onGenerate(submitState.seed, text);
            setText("");
          }}
        >
          <DialogTitle className="sr-only">Generate QR</DialogTitle>

          {previewState.seed && (
            <div className="flex justify-center">
              <div className="aspect-square w-full max-w-72">
                <QrGeneratorPreview seed={previewState.seed} />
              </div>
            </div>
          )}

          <input
            autoComplete="off"
            className="w-full rounded-[1.25rem] border border-cyan-300/14 bg-slate-950/70 px-4 py-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
            id="qr-generator-text"
            onChange={(event) => setText(event.target.value)}
            placeholder="Enter QR text"
            ref={inputRef}
            type="text"
            value={text}
          />

          {previewState.error && (
            <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
              {previewState.error}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              disabled={!canGenerate}
              type="submit"
              variant="aurora"
              className="h-auto px-5 py-2.5 text-sm font-semibold"
            >
              Play
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
