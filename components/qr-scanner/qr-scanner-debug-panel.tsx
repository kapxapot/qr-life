import type { ScannerStatus } from "@/lib/qr/qr-scanner";
import {
  formatDebugStage,
  formatPercent,
  type ScannerDebugSnapshot,
} from "@/lib/qr/qr-scanner-debug";

type Props = {
  confirmationFrameTarget: number;
  debugSnapshot: ScannerDebugSnapshot;
  scannerMessage: string;
  scannerStatus: ScannerStatus;
};

export function QrScannerDebugPanel({
  confirmationFrameTarget,
  debugSnapshot,
  scannerMessage,
  scannerStatus,
}: Props) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-2xl border border-amber-300/30 bg-slate-950/82 px-3 py-2 text-[11px] leading-5 text-amber-100 shadow-[0_10px_30px_-18px_rgba(251,191,36,0.95)] backdrop-blur">
      <p className="font-semibold uppercase tracking-[0.22em] text-amber-200/90">
        QR Debug
      </p>
      <p>Status: {scannerStatus}</p>
      <p>Message: {scannerMessage}</p>
      <p>Stage: {formatDebugStage(debugSnapshot.stage)}</p>
      <p>
        Locate: {debugSnapshot.locationCount} normal /{" "}
        {debugSnapshot.invertedLocationCount} inverted
      </p>
      <p>
        Confirm: {debugSnapshot.confirmationHits}/{confirmationFrameTarget}
      </p>
      <p>
        Frame:{" "}
        {debugSnapshot.frameWidth && debugSnapshot.frameHeight
          ? `${debugSnapshot.frameWidth}x${debugSnapshot.frameHeight}`
          : "n/a"}
      </p>
      <p>
        Payload:{" "}
        {debugSnapshot.normalizedValueLength === null
          ? "n/a"
          : `${debugSnapshot.normalizedValueLength} chars`}
      </p>
      <p>Version: {debugSnapshot.version ?? "n/a"}</p>
      <p>
        Area: {formatPercent(debugSnapshot.plausibility?.qrAreaRatio ?? null)}
      </p>
      <p>
        Aspect:{" "}
        {debugSnapshot.plausibility
          ? debugSnapshot.plausibility.aspectRatio.toFixed(2)
          : "n/a"}
      </p>
      <p>
        Centered:{" "}
        {debugSnapshot.plausibility === null
          ? "n/a"
          : debugSnapshot.plausibility.isCentered
            ? "yes"
            : "no"}
      </p>
      {debugSnapshot.rejectionReason ? (
        <p className="text-amber-50/90">{debugSnapshot.rejectionReason}</p>
      ) : null}
    </div>
  );
}
