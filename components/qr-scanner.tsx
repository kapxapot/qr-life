"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LifeGrid } from "@/lib/game-of-life";
import { createSeedFromVideo } from "@/lib/qr-seed";

type ScannerStatus = "idle" | "starting" | "ready" | "unsupported" | "error";

type DetectedBarcode = {
  boundingBox?: DOMRectReadOnly;
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

type Props = {
  onScan: (seed: LifeGrid, qrValue: string | null) => void;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function getBarcodeDetector() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.BarcodeDetector ?? null;
}

export function QrScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectingRef = useRef(false);

  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("idle");
  const [scannerMessage, setScannerMessage] = useState(
    "Enable your camera and point it at a QR code.",
  );

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const completeScan = useCallback(
    (barcode: DetectedBarcode) => {
      const video = videoRef.current;

      if (!video || !barcode.boundingBox) {
        return;
      }

      try {
        const seed = createSeedFromVideo(video, barcode.boundingBox);

        stopCamera();
        onScan(seed, barcode.rawValue ?? "QR code detected");
      } catch (error) {
        setScannerStatus("error");
        setScannerMessage(
          error instanceof Error
            ? error.message
            : "This browser couldn't turn the QR frame into a Life seed.",
        );
      }
    },
    [onScan, stopCamera],
  );

  const detectCode = useCallback(async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!detector || !video || detectingRef.current) {
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    detectingRef.current = true;

    try {
      const results = await detector.detect(video);
      const match = results.find((result) => result.boundingBox);

      if (match) {
        completeScan(match);
      }
    } catch {
      setScannerMessage(
        "The camera is live, but this browser couldn't read the QR frame yet.",
      );
    } finally {
      detectingRef.current = false;
    }
  }, [completeScan]);

  const beginScan = useCallback(async () => {
    const BarcodeDetector = getBarcodeDetector();

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      !BarcodeDetector
    ) {
      setScannerStatus("unsupported");
      setScannerMessage(
        "Live QR scanning needs a browser with BarcodeDetector support, like Chrome or Edge.",
      );
      return;
    }

    stopCamera();
    setScannerStatus("starting");
    setScannerMessage("Opening your camera...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      streamRef.current = stream;
      detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });

      const video = videoRef.current;

      if (!video) {
        throw new Error("Video element is unavailable.");
      }

      video.srcObject = stream;
      await video.play();

      setScannerStatus("ready");
      setScannerMessage("Looking for a QR code. Hold it inside the frame.");
    } catch (error) {
      stopCamera();
      setScannerStatus("error");
      setScannerMessage(
        error instanceof Error
          ? error.message
          : "Camera access was blocked before scanning started.",
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (scannerStatus !== "ready") {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      await detectCode();

      if (!cancelled) {
        scanTimerRef.current = window.setTimeout(tick, 220);
      }
    };

    void tick();

    return () => {
      cancelled = true;

      if (scanTimerRef.current) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [detectCode, scannerStatus]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-[1.75rem] border border-cyan-300/14 bg-linear-[180deg,rgba(10,18,34,0.95),rgba(5,10,20,0.95)] p-4">
        <div className="relative overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-[radial-gradient(circle_at_top,rgba(8,47,73,0.34),transparent_44%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
          <div className="relative aspect-square">
            <video
              ref={videoRef}
              autoPlay
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            <div className="pointer-events-none absolute inset-5 rounded-[1.5rem] border border-dashed border-cyan-200/18" />
            <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-px -translate-y-1/2 animate-pulse bg-linear-to-r from-transparent via-cyan-200 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.95)]" />
            <div className="pointer-events-none absolute left-8 top-8 h-10 w-10 rounded-tl-2xl border-l-2 border-t-2 border-cyan-300/70" />
            <div className="pointer-events-none absolute right-8 top-8 h-10 w-10 rounded-tr-2xl border-r-2 border-t-2 border-cyan-300/70" />
            <div className="pointer-events-none absolute bottom-8 left-8 h-10 w-10 rounded-bl-2xl border-b-2 border-l-2 border-cyan-300/70" />
            <div className="pointer-events-none absolute bottom-8 right-8 h-10 w-10 rounded-br-2xl border-b-2 border-r-2 border-cyan-300/70" />

            {scannerStatus === "ready" ? (
              <div className="pointer-events-none absolute inset-x-6 bottom-6 rounded-2xl border border-cyan-300/14 bg-slate-950/60 px-4 py-3 text-center backdrop-blur">
                <p className="text-sm font-medium text-white">
                  Looking for a QR code
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                  Hold it inside the frame
                </p>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/78 px-8 text-center">
                <div className="max-w-sm">
                  <p className="text-lg font-semibold text-white">
                    Scan a QR to bring it to life
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {scannerMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => void beginScan()}
                    disabled={scannerStatus === "starting"}
                    className="mt-5 rounded-full border border-cyan-200/20 bg-linear-to-r from-cyan-400 via-emerald-300 to-fuchsia-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_-20px_rgba(34,211,238,0.85)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {scannerStatus === "starting"
                      ? "Opening camera..."
                      : "Enable camera"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
