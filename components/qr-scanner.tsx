"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LifeGrid } from "@/lib/game-of-life";
import { type JsQrBitMatrix, type JsQrLocation, jsQr } from "@/lib/jsqr";
import { createSeedFromQrMatrix } from "@/lib/qr-seed";

type ScannerStatus = "idle" | "starting" | "ready" | "unsupported" | "error";

const REQUIRED_CONFIRMATION_FRAMES = 3;

type Props = {
  onScan: (seed: LifeGrid, qrValue: string | null) => void;
};

type PendingDetection = {
  hits: number;
  key: string;
};

function getPointDistance(
  firstPoint: { x: number; y: number },
  secondPoint: { x: number; y: number },
) {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

function isDetectionPlausible(
  location: JsQrLocation,
  width: number,
  height: number,
) {
  const points = [
    location.topLeftCorner,
    location.topRightCorner,
    location.bottomRightCorner,
    location.bottomLeftCorner,
  ];

  if (
    points.some(
      ({ x, y }) =>
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        y < 0 ||
        x > width ||
        y > height,
    )
  ) {
    return false;
  }

  const topWidth = getPointDistance(
    location.topLeftCorner,
    location.topRightCorner,
  );
  const bottomWidth = getPointDistance(
    location.bottomLeftCorner,
    location.bottomRightCorner,
  );
  const leftHeight = getPointDistance(
    location.topLeftCorner,
    location.bottomLeftCorner,
  );
  const rightHeight = getPointDistance(
    location.topRightCorner,
    location.bottomRightCorner,
  );
  const averageWidth = (topWidth + bottomWidth) / 2;
  const averageHeight = (leftHeight + rightHeight) / 2;
  const frameArea = width * height;
  const qrAreaRatio = (averageWidth * averageHeight) / Math.max(frameArea, 1);
  const aspectRatio = averageWidth / Math.max(averageHeight, 1);
  const centerX =
    (location.topLeftCorner.x +
      location.topRightCorner.x +
      location.bottomLeftCorner.x +
      location.bottomRightCorner.x) /
    4;
  const centerY =
    (location.topLeftCorner.y +
      location.topRightCorner.y +
      location.bottomLeftCorner.y +
      location.bottomRightCorner.y) /
    4;
  const isCentered =
    centerX >= width * 0.15 &&
    centerX <= width * 0.85 &&
    centerY >= height * 0.15 &&
    centerY <= height * 0.85;

  return (
    qrAreaRatio >= 0.01 &&
    aspectRatio >= 0.55 &&
    aspectRatio <= 1.8 &&
    isCentered
  );
}

export function QrScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const pendingDetectionRef = useRef<PendingDetection | null>(null);
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
    pendingDetectionRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const completeScan = useCallback(
    (rawValue: string | null, matrix: JsQrBitMatrix) => {
      try {
        const seed = createSeedFromQrMatrix(matrix);

        stopCamera();
        onScan(seed, rawValue);
      } catch (error) {
        setScannerStatus("error");
        setScannerMessage(
          error instanceof Error
            ? error.message
            : "The scanner couldn't turn the detected QR into a Life seed.",
        );
      }
    },
    [onScan, stopCamera],
  );

  const detectCode = useCallback(() => {
    const video = videoRef.current;

    if (!video || detectingRef.current) {
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const maxScanSide = 720;
    const longestSide = Math.max(video.videoWidth, video.videoHeight);
    const scale = longestSide > maxScanSide ? maxScanSide / longestSide : 1;
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = scanCanvasRef.current ?? document.createElement("canvas");

    scanCanvasRef.current = canvas;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      setScannerStatus("error");
      setScannerMessage("Canvas sampling is unavailable in this browser.");
      return;
    }

    detectingRef.current = true;

    try {
      context.drawImage(video, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const code = jsQr(imageData.data, width, height, {
        inversionAttempts: "dontInvert",
      });

      if (!code) {
        if (pendingDetectionRef.current) {
          pendingDetectionRef.current = null;
          setScannerMessage("Looking for a QR code. Hold it inside the frame.");
        }

        return;
      }

      const normalizedValue = code.data.trim();

      if (
        normalizedValue.length === 0 ||
        !isDetectionPlausible(code.location, width, height)
      ) {
        if (pendingDetectionRef.current) {
          pendingDetectionRef.current = null;
          setScannerMessage("Looking for a QR code. Hold it inside the frame.");
        }

        return;
      }

      const detectionKey = `${normalizedValue}::${code.version}`;
      const nextHits =
        pendingDetectionRef.current?.key === detectionKey
          ? pendingDetectionRef.current.hits + 1
          : 1;

      pendingDetectionRef.current = {
        hits: nextHits,
        key: detectionKey,
      };

      if (nextHits < REQUIRED_CONFIRMATION_FRAMES) {
        setScannerMessage("QR detected. Hold it still for a moment.");
        return;
      }

      completeScan(normalizedValue, code.matrix);
    } catch (error) {
      pendingDetectionRef.current = null;
      setScannerStatus("error");
      setScannerMessage(
        error instanceof Error
          ? error.message
          : "The scanner couldn't decode the camera frame.",
      );
    } finally {
      detectingRef.current = false;
    }
  }, [completeScan]);

  const beginScan = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setScannerStatus("unsupported");
      setScannerMessage(
        "Live QR scanning needs camera access in a secure browser context.",
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
      pendingDetectionRef.current = null;

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
    if (scannerStatus === "idle") {
      setScannerMessage("Enable your camera and point it at a QR code.");
    }
  }, [scannerStatus]);

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
                  {scannerMessage}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                  Keep the QR centered in the frame
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
                  <Button
                    type="button"
                    onClick={() => void beginScan()}
                    disabled={scannerStatus === "starting"}
                    variant="aurora"
                    className="mt-5 h-auto px-5 py-2.5 text-sm font-semibold disabled:hover:translate-y-0"
                  >
                    {scannerStatus === "starting"
                      ? "Opening camera..."
                      : "Enable camera"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
