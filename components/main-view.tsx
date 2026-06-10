"use client";

import { useEffect, useState } from "react";
import { GameOfLife } from "@/components/game-of-life";
import { QrGeneratorLauncher } from "@/components/qr-generator-launcher";
import { QrScanner } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LifeGrid } from "@/lib/game-of-life";
import { decodeSharedQrSeed, encodeSharedQrSeed } from "@/lib/qr-share";

type ScanResult = {
  encodedQr: string;
  qrValue: string | null;
  seed: LifeGrid;
};

type SharedScanParseResult = {
  invalidMessage: string | null;
  scanResult: ScanResult | null;
};

function syncShareUrl(encodedQr: string | null, qrValue: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (encodedQr) {
    url.searchParams.set("qr", encodedQr);
  } else {
    url.searchParams.delete("qr");
  }

  if (qrValue === null) {
    url.searchParams.delete("value");
  } else {
    url.searchParams.set("value", qrValue);
  }

  const nextRelativeUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextRelativeUrl !== currentRelativeUrl) {
    window.history.replaceState(window.history.state, "", nextRelativeUrl);
  }
}

function parseSharedScanFromSearch(search: string): SharedScanParseResult {
  const searchParams = new URLSearchParams(search);
  const encodedQr = searchParams.get("qr");

  if (encodedQr === null) {
    return searchParams.has("value")
      ? {
          invalidMessage:
            "We couldn't open that shared QR link because its encoded grid is missing. The URL has been cleared so you can scan a new code.",
          scanResult: null,
        }
      : {
          invalidMessage: null,
          scanResult: null,
        };
  }

  try {
    return {
      invalidMessage: null,
      scanResult: {
        encodedQr,
        qrValue: searchParams.has("value") ? searchParams.get("value") : null,
        seed: decodeSharedQrSeed(encodedQr),
      },
    };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "The shared QR payload is invalid.";

    return {
      invalidMessage: `We couldn't open that shared QR link. ${reason} The URL has been cleared so you can scan a new code.`,
      scanResult: null,
    };
  }
}

function InvalidShareDialog({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="border border-cyan-300/14 bg-linear-[180deg,rgba(10,18,34,0.98),rgba(5,10,20,0.98)] p-6 text-white shadow-[0_24px_80px_-40px_rgba(34,211,238,0.55)] sm:max-w-md"
        showCloseButton
      >
        <DialogHeader className="gap-3">
          <DialogTitle className="text-lg tracking-tight text-white">
            Shared link unavailable
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-300">
            {message}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-2 border-cyan-300/10 bg-slate-950/50 p-3">
          <Button
            type="button"
            onClick={onClose}
            variant="aurora"
            className="h-auto px-5 py-2.5 text-sm font-semibold"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MainView() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [shouldAutoStartScanner, setShouldAutoStartScanner] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [invalidShareMessage, setInvalidShareMessage] = useState<string | null>(
    null,
  );
  const [gameDebugEnabled, setGameDebugEnabled] = useState(false);
  const [scannerDebugEnabled, setScannerDebugEnabled] = useState(false);
  const [hasResolvedInitialShareLink, setHasResolvedInitialShareLink] =
    useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setHasResolvedInitialShareLink(true);
      return;
    }

    const nextSharedScan = parseSharedScanFromSearch(window.location.search);
    const debugMode = new URLSearchParams(window.location.search).get("debug");

    setGameDebugEnabled(
      debugMode === "1" || debugMode === "game" || debugMode === "life",
    );
    setScannerDebugEnabled(debugMode === "1" || debugMode === "qr");

    if (nextSharedScan.scanResult) {
      setScanResult(nextSharedScan.scanResult);
    }

    if (nextSharedScan.invalidMessage) {
      setInvalidShareMessage(nextSharedScan.invalidMessage);
      syncShareUrl(null, null);
    }

    setHasResolvedInitialShareLink(true);
  }, []);

  useEffect(() => {
    if (!hasResolvedInitialShareLink) {
      return;
    }

    syncShareUrl(scanResult?.encodedQr ?? null, scanResult?.qrValue ?? null);
  }, [hasResolvedInitialShareLink, scanResult]);

  if (!hasResolvedInitialShareLink) {
    return (
      <section className="flex h-full w-full items-center justify-center">
        <output
          aria-label="Loading"
          className="flex items-center justify-center"
        >
          <div
            aria-hidden="true"
            className="size-12 animate-spin rounded-full border-2 border-cyan-200/25 border-t-cyan-200 shadow-[0_0_20px_rgba(103,232,249,0.35)]"
          />
        </output>
      </section>
    );
  }

  if (scanResult) {
    return (
      <section className="relative h-full w-full overflow-hidden">
        <GameOfLife
          debug={gameDebugEnabled}
          onScanAnother={() => {
            setShouldAutoStartScanner(true);
            setScanResult(null);
          }}
          qrValue={scanResult.qrValue}
          seed={scanResult.seed}
        />
        <InvalidShareDialog
          message={invalidShareMessage}
          onClose={() => setInvalidShareMessage(null)}
        />
      </section>
    );
  }

  return (
    <section className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 lg:gap-6">
        {!isGeneratorOpen && (
          <h1 className="max-w-md text-center text-xl font-semibold tracking-tight text-white sm:text-2xl lg:text-3xl">
            Scan a QR to{" "}
            <span className="bg-linear-to-r from-cyan-300 via-emerald-300 to-fuchsia-400 bg-clip-text text-transparent">
              bring it to life
            </span>
          </h1>
        )}

        {!isGeneratorOpen && (
          <div className="relative w-[95vmin] rounded-[2rem] shadow-[0_0_15px_0_rgba(34,211,238,0.45)] sm:w-[60vmin]">
            <QrScanner
              autoStart={shouldAutoStartScanner}
              debug={scannerDebugEnabled}
              isPaused={isGeneratorOpen}
              onScan={(seed, qrValue) => {
                setShouldAutoStartScanner(false);
                setScanResult({
                  encodedQr: encodeSharedQrSeed(seed),
                  qrValue,
                  seed,
                });
              }}
            />
          </div>
        )}

        <QrGeneratorLauncher
          onGenerate={(seed, qrValue) => {
            setShouldAutoStartScanner(false);
            setScanResult({
              encodedQr: encodeSharedQrSeed(seed),
              qrValue,
              seed,
            });
          }}
          onOpenChange={setIsGeneratorOpen}
        />

        {!isGeneratorOpen && (
          <div className="text-xs text-muted-foreground flex gap-2 items-center">
            <span>&copy; 2026</span>
            <span>Created by{" "}
              <a
                href="https://github.com/kapxapot"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Sergey Atroshchenko
              </a>
            </span>

            <a
              href="https://x.com/kapxapot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="X (Twitter)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        )}

        <InvalidShareDialog
          message={invalidShareMessage}
          onClose={() => setInvalidShareMessage(null)}
        />
      </div>
    </section>
  );
}
