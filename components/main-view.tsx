"use client";

import { useState } from "react";
import { GameOfLife } from "@/components/game-of-life";
import { QrScanner } from "@/components/qr-scanner";
import type { LifeGrid } from "@/lib/game-of-life";

type ScanResult = {
  qrValue: string | null;
  seed: LifeGrid;
};

export function MainView() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-[0_28px_90px_-34px_rgba(34,211,238,0.45)] backdrop-blur-2xl sm:p-7">
      {scanResult ? (
        <GameOfLife
          onScanAnother={() => setScanResult(null)}
          qrValue={scanResult.qrValue}
          seed={scanResult.seed}
        />
      ) : (
        <QrScanner
          onScan={(seed, qrValue) => {
            setScanResult({ qrValue, seed });
          }}
        />
      )}
    </section>
  );
}
