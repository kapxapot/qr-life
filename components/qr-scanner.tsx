"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrScannerDebugPanel } from "@/components/qr-scanner-debug-panel";
import { Button } from "@/components/ui/button";
import type { LifeGrid } from "@/lib/game-of-life";
import { type JsQrBitMatrix, jsQr } from "@/lib/jsqr";
import { getCameraAccessMessage, type ScannerStatus } from "@/lib/qr-scanner";
import {
  createInitialDebugSnapshot,
  getDetectionPlausibility,
  getPlausibilityRejectionReason,
  getQrLocationDiagnostics,
  type ScannerDebugSnapshot,
} from "@/lib/qr-scanner-debug";
import { createSeedFromQrMatrix } from "@/lib/qr-seed";

type CameraPermissionState =
  | PermissionState
  | "checking"
  | "unknown"
  | "unsupported";
type CameraPermissionDescriptor = PermissionDescriptor & { name: "camera" };

const REQUIRED_CONFIRMATION_FRAMES = 3;

type Props = {
  autoStart?: boolean;
  debug?: boolean;
  onScan: (seed: LifeGrid, qrValue: string | null) => void;
};

type PendingDetection = {
  hits: number;
  key: string;
};

export function QrScanner({ autoStart = false, debug = false, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const hasAttemptedAutoScanRef = useRef(false);
  const pendingDetectionRef = useRef<PendingDetection | null>(null);
  const [cameraPermissionState, setCameraPermissionState] =
    useState<CameraPermissionState>("checking");
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("idle");
  const [scannerMessage, setScannerMessage] = useState("Checking camera...");
  const [debugSnapshot, setDebugSnapshot] = useState<ScannerDebugSnapshot>(
    createInitialDebugSnapshot,
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
      const diagnostics = debug
        ? getQrLocationDiagnostics(imageData.data, width, height)
        : null;
      const code = jsQr(imageData.data, width, height);

      if (!code) {
        if (debug) {
          const hasLocatedQr = Boolean(
            diagnostics &&
              (diagnostics.locationCount > 0 ||
                diagnostics.invertedLocationCount > 0),
          );

          setDebugSnapshot({
            confirmationHits: 0,
            frameHeight: height,
            frameWidth: width,
            invertedLocationCount: diagnostics?.invertedLocationCount ?? 0,
            locationCount: diagnostics?.locationCount ?? 0,
            normalizedValueLength: null,
            plausibility: null,
            rejectionReason: hasLocatedQr
              ? "Finder patterns were detected, but the payload could not be decoded from this frame."
              : "No plausible finder pattern was located in this frame.",
            stage: hasLocatedQr ? "located-but-undecodable" : "no-qr-located",
            version: null,
          });
        }

        if (pendingDetectionRef.current) {
          pendingDetectionRef.current = null;
          setScannerMessage("Looking for a QR code. Hold it inside the frame.");
        }

        return;
      }

      const normalizedValue = code.data.trim();
      const plausibility = getDetectionPlausibility(
        code.location,
        width,
        height,
      );

      if (normalizedValue.length === 0 || !plausibility.isValid) {
        if (debug) {
          setDebugSnapshot({
            confirmationHits: 0,
            frameHeight: height,
            frameWidth: width,
            invertedLocationCount: diagnostics?.invertedLocationCount ?? 0,
            locationCount: diagnostics?.locationCount ?? 0,
            normalizedValueLength: normalizedValue.length,
            plausibility,
            rejectionReason:
              normalizedValue.length === 0
                ? "The QR decoder returned an empty string."
                : getPlausibilityRejectionReason(plausibility),
            stage:
              normalizedValue.length === 0
                ? "decoded-empty"
                : "decoded-but-rejected",
            version: code.version,
          });
        }

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
        if (debug) {
          setDebugSnapshot({
            confirmationHits: nextHits,
            frameHeight: height,
            frameWidth: width,
            invertedLocationCount: diagnostics?.invertedLocationCount ?? 0,
            locationCount: diagnostics?.locationCount ?? 0,
            normalizedValueLength: normalizedValue.length,
            plausibility,
            rejectionReason: `The same QR must decode ${REQUIRED_CONFIRMATION_FRAMES} times in a row before the app accepts it.`,
            stage: "pending-confirmation",
            version: code.version,
          });
        }

        setScannerMessage("QR detected. Hold it still for a moment.");
        return;
      }

      if (debug) {
        setDebugSnapshot({
          confirmationHits: nextHits,
          frameHeight: height,
          frameWidth: width,
          invertedLocationCount: diagnostics?.invertedLocationCount ?? 0,
          locationCount: diagnostics?.locationCount ?? 0,
          normalizedValueLength: normalizedValue.length,
          plausibility,
          rejectionReason: null,
          stage: "scan-complete",
          version: code.version,
        });
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
  }, [completeScan, debug]);

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
    setScannerMessage("Initializing camera...");
    setDebugSnapshot(createInitialDebugSnapshot());

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
      setScannerMessage(getCameraAccessMessage(error));
    }
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (scannerStatus !== "idle") {
      return;
    }

    if (cameraPermissionState === "checking") {
      setScannerMessage("Preparing scanner...");
      return;
    }

    if (cameraPermissionState === "unsupported") {
      setScannerStatus("unsupported");
      setScannerMessage(
        "Live QR scanning needs camera access in a secure browser context.",
      );
      return;
    }

    if (cameraPermissionState === "denied") {
      setScannerStatus("error");
      setScannerMessage(
        "Camera access is blocked in your browser for this site. Open the site settings and allow camera access to continue.",
      );
      return;
    }

    if (autoStart || !hasAttemptedAutoScanRef.current) {
      hasAttemptedAutoScanRef.current = true;
      void beginScan();
      return;
    }

    setScannerMessage("Enable your camera and point it at a QR code.");
  }, [autoStart, beginScan, cameraPermissionState, scannerStatus]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermissionState("unsupported");
      return;
    }

    if (!navigator.permissions?.query) {
      setCameraPermissionState("unknown");
      return;
    }

    let isCancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    const syncPermissionState = () => {
      if (isCancelled || !permissionStatus) {
        return;
      }

      setCameraPermissionState(permissionStatus.state);
    };

    void navigator.permissions
      .query({ name: "camera" } as CameraPermissionDescriptor)
      .then((nextPermissionStatus) => {
        if (isCancelled) {
          return;
        }

        permissionStatus = nextPermissionStatus;
        syncPermissionState();
        permissionStatus.onchange = syncPermissionState;
      })
      .catch(() => {
        if (!isCancelled) {
          setCameraPermissionState("unknown");
        }
      });

    return () => {
      isCancelled = true;

      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

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
    <div className="relative overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-[radial-gradient(circle_at_top,rgba(8,47,73,0.34),transparent_44%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
      <div className="relative aspect-square">
        <video
          ref={videoRef}
          autoPlay
          className="h-full w-full object-cover"
          muted
          playsInline
        />
        {debug && (
          <QrScannerDebugPanel
            confirmationFrameTarget={REQUIRED_CONFIRMATION_FRAMES}
            debugSnapshot={debugSnapshot}
            scannerMessage={scannerMessage}
            scannerStatus={scannerStatus}
          />
        )}
        <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-px -translate-y-1/2 animate-pulse bg-linear-to-r from-transparent via-cyan-200 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.95)]" />
        <div className="pointer-events-none absolute left-4 sm:left-6 lg:left-8 top-4 sm:top-6 lg:top-8 h-10 w-10 rounded-tl-2xl border-l-2 border-t-2 border-cyan-300/70" />
        <div className="pointer-events-none absolute right-4 sm:right-6 lg:right-8 top-4 sm:top-6 lg:top-8 h-10 w-10 rounded-tr-2xl border-r-2 border-t-2 border-cyan-300/70" />
        <div className="pointer-events-none absolute bottom-4 sm:bottom-6 lg:bottom-8 left-4 sm:left-6 lg:left-8 h-10 w-10 rounded-bl-2xl border-b-2 border-l-2 border-cyan-300/70" />
        <div className="pointer-events-none absolute bottom-4 sm:bottom-6 lg:bottom-8 right-4 sm:right-6 lg:right-8 h-10 w-10 rounded-br-2xl border-b-2 border-r-2 border-cyan-300/70" />

        {scannerStatus === "ready" ? (
          <div className="pointer-events-none absolute bottom-8 sm:bottom-10 lg:bottom-12 left-1/2 -translate-x-1/2 rounded-2xl border border-cyan-300/14 bg-slate-950/30 px-4 py-3 text-center backdrop-blur w-[80%]">
            <p className="text-sm font-medium text-white">{scannerMessage}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
              Keep the QR centered
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/78 px-8 text-center">
            <div className="max-w-sm">
              <h1 className="mt-6 text-xl font-semibold tracking-tight text-white sm:text-2xl lg:text-3xl">
                Scan a QR to{" "}
                <span className="bg-linear-to-r from-cyan-300 via-emerald-300 to-fuchsia-400 bg-clip-text text-transparent">
                  bring it to life
                </span>
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                {scannerMessage}
              </p>

              {scannerStatus !== "starting" &&
                scannerStatus !== "idle" &&
                cameraPermissionState !== "denied" && (
                  <Button
                    type="button"
                    onClick={() => void beginScan()}
                    variant="aurora"
                    className="mt-5 h-auto px-5 py-2.5 text-sm font-semibold disabled:hover:translate-y-0"
                  >
                    Enable camera
                  </Button>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
