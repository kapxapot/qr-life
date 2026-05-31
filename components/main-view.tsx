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
  const [shouldAutoStartScanner, setShouldAutoStartScanner] = useState(false);

  return (
    <section className="w-[95vmin] rounded-[2rem] shadow-[0_0_15px_0_rgba(34,211,238,0.45)] sm:w-[80vmin]">
      {scanResult ? (
        <GameOfLife
          onScanAnother={() => {
            setShouldAutoStartScanner(true);
            setScanResult(null);
          }}
          qrValue={scanResult.qrValue}
          seed={scanResult.seed}
        />
      ) : (
        <QrScanner
          autoStart={shouldAutoStartScanner}
          onScan={(seed, qrValue) => {
            setShouldAutoStartScanner(false);
            setScanResult({ qrValue, seed });
          }}
        />
      )}
    </section>
  );
}
