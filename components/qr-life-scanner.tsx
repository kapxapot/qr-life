"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  countPopulation,
  type LifeGrid,
  nextGeneration,
} from "@/lib/game-of-life";

const GRID_SIZE = 33;
const CANVAS_CELL_SIZE = 16;

type ScannerStatus =
  | "idle"
  | "starting"
  | "ready"
  | "scanned"
  | "unsupported"
  | "error";

type DetectedBarcode = {
  boundingBox?: DOMRectReadOnly;
  format?: string;
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createSeedFromVideo(
  video: HTMLVideoElement,
  boundingBox: DOMRectReadOnly,
): LifeGrid {
  const side = Math.max(boundingBox.width, boundingBox.height) * 1.35;
  const centerX = boundingBox.x + boundingBox.width / 2;
  const centerY = boundingBox.y + boundingBox.height / 2;
  const sourceSize = Math.min(side, video.videoWidth, video.videoHeight);
  const sourceX = clamp(
    centerX - sourceSize / 2,
    0,
    video.videoWidth - sourceSize,
  );
  const sourceY = clamp(
    centerY - sourceSize / 2,
    0,
    video.videoHeight - sourceSize,
  );

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = GRID_SIZE;
  sampleCanvas.height = GRID_SIZE;

  const sampleContext = sampleCanvas.getContext("2d");

  if (!sampleContext) {
    throw new Error("Canvas sampling is unavailable in this browser.");
  }

  sampleContext.drawImage(
    video,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    GRID_SIZE,
    GRID_SIZE,
  );

  const { data } = sampleContext.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const luminances: number[] = [];
  let luminanceTotal = 0;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;

    luminances.push(luminance);
    luminanceTotal += luminance;
  }

  const averageLuminance = luminanceTotal / luminances.length;

  const buildGrid = (threshold: number) =>
    Array.from({ length: GRID_SIZE }, (_, rowIndex) =>
      Array.from({ length: GRID_SIZE }, (_, columnIndex) => {
        const sample = luminances[rowIndex * GRID_SIZE + columnIndex] ?? 255;
        return sample < threshold;
      }),
    );

  let threshold = averageLuminance * 0.94;
  let seed = buildGrid(threshold);
  let density = countPopulation(seed) / (GRID_SIZE * GRID_SIZE);

  if (density < 0.18) {
    threshold = averageLuminance * 1.08;
    seed = buildGrid(threshold);
    density = countPopulation(seed) / (GRID_SIZE * GRID_SIZE);
  }

  if (density > 0.62) {
    threshold = averageLuminance * 0.82;
    seed = buildGrid(threshold);
  }

  return seed;
}

function drawGrid(canvas: HTMLCanvasElement, grid: LifeGrid) {
  const rowCount = grid.length;
  const columnCount = grid[0]?.length ?? 0;
  const canvasWidth = columnCount * CANVAS_CELL_SIZE;
  const canvasHeight = rowCount * CANVAS_CELL_SIZE;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "#030712";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const x = columnIndex * CANVAS_CELL_SIZE;
      const y = rowIndex * CANVAS_CELL_SIZE;

      context.fillStyle = "#0f172a";
      context.fillRect(
        x + 1,
        y + 1,
        CANVAS_CELL_SIZE - 2,
        CANVAS_CELL_SIZE - 2,
      );

      if (!grid[rowIndex]?.[columnIndex]) {
        continue;
      }

      const gradient = context.createLinearGradient(
        x,
        y,
        x + CANVAS_CELL_SIZE,
        y + CANVAS_CELL_SIZE,
      );

      gradient.addColorStop(0, "#67e8f9");
      gradient.addColorStop(0.55, "#6ee7b7");
      gradient.addColorStop(1, "#f0abfc");

      context.fillStyle = gradient;
      context.fillRect(
        x + 1.75,
        y + 1.75,
        CANVAS_CELL_SIZE - 3.5,
        CANVAS_CELL_SIZE - 3.5,
      );
    }
  }
}

function truncateValue(value: string) {
  if (value.length <= 84) {
    return value;
  }

  return `${value.slice(0, 84)}...`;
}

export function QrLifeScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const gridRef = useRef<LifeGrid | null>(null);
  const initialGridRef = useRef<LifeGrid | null>(null);
  const detectingRef = useRef(false);

  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("idle");
  const [scannerMessage, setScannerMessage] = useState(
    "Enable your camera and point it at a QR code.",
  );
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [grid, setGrid] = useState<LifeGrid | null>(null);
  const [generation, setGeneration] = useState(0);
  const [population, setPopulation] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

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

  const stopSimulation = useCallback(() => {
    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }

    setIsRunning(false);
  }, []);

  const renderCanvas = useCallback((nextGrid: LifeGrid | null) => {
    const canvas = canvasRef.current;

    if (!canvas || !nextGrid) {
      return;
    }

    drawGrid(canvas, nextGrid);
  }, []);

  const completeScan = useCallback(
    (barcode: DetectedBarcode) => {
      const video = videoRef.current;

      if (!video || !barcode.boundingBox) {
        return;
      }

      const nextGrid = createSeedFromVideo(video, barcode.boundingBox);
      const nextPopulation = countPopulation(nextGrid);

      stopCamera();
      gridRef.current = nextGrid;
      initialGridRef.current = nextGrid.map((row) => [...row]);

      startTransition(() => {
        setGrid(nextGrid);
        setGeneration(0);
        setPopulation(nextPopulation);
        setQrValue(barcode.rawValue ?? "QR code detected");
        setScannerStatus("scanned");
        setScannerMessage("QR captured. This is its first Life state.");
        setIsRunning(false);
      });
    },
    [stopCamera],
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

    stopSimulation();
    stopCamera();

    setGrid(null);
    gridRef.current = null;
    initialGridRef.current = null;
    setQrValue(null);
    setGeneration(0);
    setPopulation(0);
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

      if (error instanceof Error) {
        setScannerMessage(error.message);
      } else {
        setScannerMessage("Camera access was blocked before scanning started.");
      }
    }
  }, [stopCamera, stopSimulation]);

  const advanceLife = useCallback(() => {
    const currentGrid = gridRef.current;

    if (!currentGrid) {
      return;
    }

    const nextGrid = nextGeneration(currentGrid);
    const nextPopulation = countPopulation(nextGrid);

    gridRef.current = nextGrid;

    startTransition(() => {
      setGrid(nextGrid);
      setGeneration((value) => value + 1);
      setPopulation(nextPopulation);
    });

    if (nextPopulation === 0) {
      stopSimulation();
      setScannerMessage("The colony faded out. Scan another QR to try again.");
    }
  }, [stopSimulation]);

  useEffect(() => {
    return () => {
      stopSimulation();
      stopCamera();
    };
  }, [stopCamera, stopSimulation]);

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

    tick();

    return () => {
      cancelled = true;

      if (scanTimerRef.current) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [detectCode, scannerStatus]);

  useEffect(() => {
    renderCanvas(grid);
  }, [grid, renderCanvas]);

  useEffect(() => {
    if (!isRunning || !grid) {
      return;
    }

    simulationTimerRef.current = window.setInterval(advanceLife, 180);

    return () => {
      if (simulationTimerRef.current) {
        window.clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [advanceLife, grid, isRunning]);

  const handleStart = () => {
    if (!grid) {
      return;
    }

    setScannerMessage("The colony is evolving.");
    setIsRunning((current) => !current);
  };

  const handleReset = () => {
    const initialGrid = initialGridRef.current;

    if (!initialGrid) {
      return;
    }

    stopSimulation();
    const nextGrid = initialGrid.map((row) => [...row]);

    gridRef.current = nextGrid;
    setGrid(nextGrid);
    setGeneration(0);
    setPopulation(countPopulation(nextGrid));
    setScannerMessage(
      "Back to the scanned seed. Start it again whenever you want.",
    );
  };

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-[0_28px_90px_-34px_rgba(34,211,238,0.45)] backdrop-blur-2xl sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-3xl border border-white/8 bg-white/4 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
                Bring It To Life
              </p>
              <p className="mt-1 text-sm text-slate-300">{scannerMessage}</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-white/80">
              {scannerStatus === "scanned" ? "Scanned" : "Waiting"}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(10,18,34,0.95),rgba(5,10,20,0.95))] p-4">
            {grid ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-[#020617] p-3">
                  <canvas
                    ref={canvasRef}
                    className="aspect-square w-full rounded-2xl"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleStart}
                    className="rounded-full border border-cyan-200/20 bg-gradient-to-r from-cyan-400 via-emerald-300 to-fuchsia-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_-20px_rgba(34,211,238,0.85)] transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    {isRunning ? "Pause" : "Start"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-full border border-white/12 bg-white/6 px-5 py-2.5 text-sm font-semibold text-white/90 transition-colors duration-200 hover:bg-white/10"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => void beginScan()}
                    className="rounded-full border border-white/12 bg-transparent px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors duration-200 hover:border-cyan-200/30 hover:text-white"
                  >
                    Scan another QR
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-[radial-gradient(circle_at_top,_rgba(8,47,73,0.34),transparent_44%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
                  <div className="relative aspect-square">
                    <video
                      ref={videoRef}
                      autoPlay
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                    <div className="pointer-events-none absolute inset-5 rounded-[1.5rem] border border-dashed border-cyan-200/18" />
                    <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-px -translate-y-1/2 animate-pulse bg-gradient-to-r from-transparent via-cyan-200 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.95)]" />
                    <div className="pointer-events-none absolute left-8 top-8 h-10 w-10 rounded-tl-2xl border-l-2 border-t-2 border-cyan-300/70" />
                    <div className="pointer-events-none absolute right-8 top-8 h-10 w-10 rounded-tr-2xl border-r-2 border-t-2 border-cyan-300/70" />
                    <div className="pointer-events-none absolute bottom-8 left-8 h-10 w-10 rounded-bl-2xl border-b-2 border-l-2 border-cyan-300/70" />
                    <div className="pointer-events-none absolute bottom-8 right-8 h-10 w-10 rounded-br-2xl border-b-2 border-r-2 border-cyan-300/70" />

                    {scannerStatus === "idle" ||
                    scannerStatus === "unsupported" ||
                    scannerStatus === "error" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 px-8 text-center">
                        <div>
                          <p className="text-lg font-semibold text-white">
                            Scan a QR to bring it to life
                          </p>
                          <p className="mt-3 text-sm leading-6 text-slate-300">
                            {scannerMessage}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void beginScan()}
                    disabled={scannerStatus === "starting"}
                    className="rounded-full border border-cyan-200/20 bg-gradient-to-r from-cyan-400 via-emerald-300 to-fuchsia-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_-20px_rgba(34,211,238,0.85)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {scannerStatus === "starting"
                      ? "Opening camera..."
                      : scannerStatus === "ready"
                        ? "Scanning..."
                        : "Enable camera"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/4 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-200/70">
              Status
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
                <dt className="text-sm text-slate-400">Iteration</dt>
                <dd className="mt-1 font-mono text-2xl text-white">
                  {generation}
                </dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
                <dt className="text-sm text-slate-400">Population</dt>
                <dd className="mt-1 font-mono text-2xl text-cyan-200">
                  {population}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/4 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
              Decoded Value
            </p>
            <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-xs leading-6 text-slate-300">
              {qrValue ? truncateValue(qrValue) : "No QR captured yet."}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/4 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">
              Flow
            </p>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <li>1. Open the camera and hold a QR code inside the frame.</li>
              <li>2. We sample the detected QR image into a Life seed.</li>
              <li>3. Press Start and watch the colony evolve.</li>
            </ol>
          </div>
        </aside>
      </div>
    </section>
  );
}
