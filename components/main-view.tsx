"use client";

import { useEffect, useState } from "react";
import { GameOfLife } from "@/components/game-of-life";
import { QrScanner } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
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

export function MainView() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [shouldAutoStartScanner, setShouldAutoStartScanner] = useState(false);
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

        {invalidShareMessage && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="invalid-share-title"
              className="w-full max-w-md rounded-[1.75rem] border border-cyan-300/14 bg-linear-[180deg,rgba(10,18,34,0.98),rgba(5,10,20,0.98)] p-6 shadow-[0_24px_80px_-40px_rgba(34,211,238,0.55)]"
            >
              <h2
                id="invalid-share-title"
                className="text-lg font-semibold tracking-tight text-white"
              >
                Shared link unavailable
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                {invalidShareMessage}
              </p>

              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setInvalidShareMessage(null)}
                  variant="aurora"
                  className="h-auto px-5 py-2.5 text-sm font-semibold"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="flex h-full w-full items-center justify-center">
      <div className="relative w-[95vmin] rounded-[2rem] shadow-[0_0_15px_0_rgba(34,211,238,0.45)] sm:w-[80vmin]">
        <QrScanner
          autoStart={shouldAutoStartScanner}
          debug={scannerDebugEnabled}
          onScan={(seed, qrValue) => {
            setShouldAutoStartScanner(false);
            setScanResult({
              encodedQr: encodeSharedQrSeed(seed),
              qrValue,
              seed,
            });
          }}
        />

        {invalidShareMessage && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[2rem] bg-slate-950/70 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="invalid-share-title"
              className="w-full max-w-md rounded-[1.75rem] border border-cyan-300/14 bg-linear-[180deg,rgba(10,18,34,0.98),rgba(5,10,20,0.98)] p-6 shadow-[0_24px_80px_-40px_rgba(34,211,238,0.55)]"
            >
              <h2
                id="invalid-share-title"
                className="text-lg font-semibold tracking-tight text-white"
              >
                Shared link unavailable
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                {invalidShareMessage}
              </p>

              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setInvalidShareMessage(null)}
                  variant="aurora"
                  className="h-auto px-5 py-2.5 text-sm font-semibold"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
