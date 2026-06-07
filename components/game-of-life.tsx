"use client";

import { RiCheckLine, RiFileCopyLine, RiShareLine } from "@remixicon/react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cloneUniverse,
  countPopulation,
  createUniverseFromSeed,
  getUniverseBounds,
  type LifeGrid,
  type LifeUniverse,
  nextGeneration,
} from "@/lib/game-of-life";

const CANVAS_CELL_SIZE = 14;
const GRIDLINE_CELL_INSET = 1;
const LIVE_CELL_INSET = 1.75;
const GRID_INSET_START_RATIO = 0.8;
const GRID_INSET_END_RATIO = 1.6;
const MIN_VISIBLE_LIVE_CELL_GAP_DEVICE_PIXELS = 2;
const LIVE_CELL_COLOR = "#67e8f9";
const MIN_VIEWPORT_SPAN = 41;
const VIEWPORT_PADDING = 6;
const DEFAULT_ZOOM_FACTOR = 1;
const DEFAULT_TICK_DELAY_MS = 200;
const ZOOM_STEP = 1.25;
const MIN_TICK_DELAY_MS = 0;
const MAX_TICK_DELAY_MS = 400;
const TICK_DELAY_STORAGE_KEY = "qr-life:game-of-life:tick-delay-ms";

type Props = {
  onScanAnother: () => void;
  qrValue: string | null;
  seed: LifeGrid;
};

type SessionProps = Props & {
  onReset: () => void;
};

type Viewport = {
  minX: number;
  minY: number;
  span: number;
};

type ViewportCenter = {
  x: number;
  y: number;
};

type InitialGameViewState = {
  population: number;
  universe: LifeUniverse;
  viewportBaseSpan: number;
  viewportCenter: ViewportCenter;
};

function clampTickDelayMs(value: number) {
  return Math.min(MAX_TICK_DELAY_MS, Math.max(MIN_TICK_DELAY_MS, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getGridInsetStrength(displayCellSize: number) {
  const normalizedCellSize = Math.max(0, displayCellSize / CANVAS_CELL_SIZE);
  const insetProgress = clamp(
    (normalizedCellSize - GRID_INSET_START_RATIO) /
      (GRID_INSET_END_RATIO - GRID_INSET_START_RATIO),
    0,
    1,
  );

  // Keep small cells completely solid, then ease the inset in only once the
  // cells are large enough for the separation to read as an intentional grid.
  return insetProgress * insetProgress * (3 - 2 * insetProgress);
}

function snapInsetToDevicePixels(
  inset: number,
  devicePixelRatio: number,
  minGapDevicePixels: number,
) {
  if (inset <= 0) {
    return 0;
  }

  const minimumInset = minGapDevicePixels / 2 / devicePixelRatio;

  return Math.max(
    minimumInset,
    Math.ceil(inset * devicePixelRatio) / devicePixelRatio,
  );
}

function createSeedUniverse(seed: LifeGrid): LifeUniverse {
  return createUniverseFromSeed(seed);
}

function createInitialGameViewState(seed: LifeGrid): InitialGameViewState {
  const universe = createSeedUniverse(seed);
  const viewportCenter = getSeedViewportCenter(seed);

  return {
    population: countPopulation(universe),
    universe,
    viewportBaseSpan: getViewportBaseSpan(universe, universe, viewportCenter),
    viewportCenter,
  };
}

function getSeedViewportCenter(seed: LifeGrid): ViewportCenter {
  const rowCount = seed.length;
  const columnCount = seed[0]?.length ?? 0;

  if (rowCount === 0 || columnCount === 0) {
    return { x: 0, y: 0 };
  }

  const minX = -Math.floor(columnCount / 2);
  const maxX = minX + columnCount - 1;
  const minY = -Math.floor(rowCount / 2);
  const maxY = minY + rowCount - 1;

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

function createViewport(center: ViewportCenter, span: number): Viewport {
  const halfSpan = (span - 1) / 2;

  return {
    minX: Math.floor(center.x - halfSpan),
    minY: Math.floor(center.y - halfSpan),
    span,
  };
}

function parseCellKey(key: string): ViewportCenter {
  const [xValue = "0", yValue = "0"] = key.split(":");

  return {
    x: Number(xValue),
    y: Number(yValue),
  };
}

function normalizeViewportSpan(span: number, center: ViewportCenter): number {
  let nextSpan = Math.max(1, Math.ceil(span));
  const shouldUseOddSpan =
    Number.isInteger(center.x) && Number.isInteger(center.y);

  if ((nextSpan % 2 === 1) !== shouldUseOddSpan) {
    nextSpan += 1;
  }

  return nextSpan;
}

function getViewportBaseSpan(
  universe: LifeUniverse,
  fallbackUniverse: LifeUniverse,
  center: ViewportCenter,
): number {
  const boundsSource = universe.size > 0 ? universe : fallbackUniverse;
  const bounds = getUniverseBounds(boundsSource);

  if (!bounds) {
    return normalizeViewportSpan(MIN_VIEWPORT_SPAN, center);
  }

  const minX = bounds.minX - VIEWPORT_PADDING;
  const maxX = bounds.maxX + VIEWPORT_PADDING;
  const minY = bounds.minY - VIEWPORT_PADDING;
  const maxY = bounds.maxY + VIEWPORT_PADDING;
  const furthestEdgeDistance = Math.max(
    Math.abs(center.x - minX),
    Math.abs(maxX - center.x),
    Math.abs(center.y - minY),
    Math.abs(maxY - center.y),
  );

  return normalizeViewportSpan(
    Math.max(MIN_VIEWPORT_SPAN, Math.ceil(furthestEdgeDistance * 2 + 1)),
    center,
  );
}

function buildViewport(
  baseSpan: number,
  center: ViewportCenter,
  zoomFactor: number,
): Viewport {
  const span = normalizeViewportSpan(
    Math.max(1, baseSpan / zoomFactor),
    center,
  );

  return createViewport(center, span);
}

function drawUniverse(
  canvas: HTMLCanvasElement,
  universe: LifeUniverse,
  viewportBaseSpan: number,
  center: ViewportCenter,
  zoomFactor: number,
) {
  const viewport = buildViewport(viewportBaseSpan, center, zoomFactor);
  const renderedCanvasSize = Math.max(
    1,
    Math.floor(canvas.clientWidth || canvas.getBoundingClientRect().width),
  );
  const devicePixelRatio = window.devicePixelRatio || 1;
  const displayCellSize = renderedCanvasSize / viewport.span;
  const gridlineInset =
    (displayCellSize * GRIDLINE_CELL_INSET) / CANVAS_CELL_SIZE;
  const liveCellInset = (displayCellSize * LIVE_CELL_INSET) / CANVAS_CELL_SIZE;
  const gridInsetStrength = getGridInsetStrength(displayCellSize);
  const desiredLiveCellInset = liveCellInset * gridInsetStrength;
  const effectiveLiveCellInset = snapInsetToDevicePixels(
    desiredLiveCellInset,
    devicePixelRatio,
    MIN_VISIBLE_LIVE_CELL_GAP_DEVICE_PIXELS,
  );
  const insetScale =
    liveCellInset > 0 ? clamp(effectiveLiveCellInset / liveCellInset, 0, 1) : 0;
  const effectiveGridlineInset = gridlineInset * insetScale;
  const shouldDrawGrid = gridInsetStrength > 0;

  // Keep the bitmap matched to the visible canvas so zooming out
  // doesn't allocate giant off-screen surfaces.
  canvas.width = Math.round(renderedCanvasSize * devicePixelRatio);
  canvas.height = Math.round(renderedCanvasSize * devicePixelRatio);

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, renderedCanvasSize, renderedCanvasSize);
  context.fillStyle = "#030712";
  context.fillRect(0, 0, renderedCanvasSize, renderedCanvasSize);

  if (!shouldDrawGrid) {
    const rasterCanvas = document.createElement("canvas");
    rasterCanvas.width = viewport.span;
    rasterCanvas.height = viewport.span;

    const rasterContext = rasterCanvas.getContext("2d");

    if (!rasterContext) {
      return;
    }

    rasterContext.imageSmoothingEnabled = false;
    rasterContext.fillStyle = LIVE_CELL_COLOR;

    for (const cellKey of universe) {
      const { x: worldX, y: worldY } = parseCellKey(cellKey);
      const columnIndex = worldX - viewport.minX;
      const rowIndex = worldY - viewport.minY;

      if (
        columnIndex < 0 ||
        columnIndex >= viewport.span ||
        rowIndex < 0 ||
        rowIndex >= viewport.span
      ) {
        continue;
      }

      rasterContext.fillRect(columnIndex, rowIndex, 1, 1);
    }

    context.drawImage(
      rasterCanvas,
      0,
      0,
      renderedCanvasSize,
      renderedCanvasSize,
    );
    return;
  }

  if (shouldDrawGrid) {
    context.fillStyle = "#0f172a";
    context.globalAlpha = gridInsetStrength;

    for (let rowIndex = 0; rowIndex < viewport.span; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < viewport.span; columnIndex += 1) {
        const x = columnIndex * displayCellSize;
        const y = rowIndex * displayCellSize;

        context.fillRect(
          x + effectiveGridlineInset,
          y + effectiveGridlineInset,
          displayCellSize - effectiveGridlineInset * 2,
          displayCellSize - effectiveGridlineInset * 2,
        );
      }
    }

    context.globalAlpha = 1;
  }

  context.fillStyle = LIVE_CELL_COLOR;

  for (const cellKey of universe) {
    const { x: worldX, y: worldY } = parseCellKey(cellKey);
    const columnIndex = worldX - viewport.minX;
    const rowIndex = worldY - viewport.minY;

    if (
      columnIndex < 0 ||
      columnIndex >= viewport.span ||
      rowIndex < 0 ||
      rowIndex >= viewport.span
    ) {
      continue;
    }

    const x = columnIndex * displayCellSize;
    const y = rowIndex * displayCellSize;

    context.fillRect(
      x + effectiveLiveCellInset,
      y + effectiveLiveCellInset,
      displayCellSize - effectiveLiveCellInset * 2,
      displayCellSize - effectiveLiveCellInset * 2,
    );
  }
}

function GameOfLifeSession({
  onReset,
  onScanAnother,
  qrValue,
  seed,
}: SessionProps) {
  const initialGameViewState = createInitialGameViewState(seed);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const shareFeedbackTimerRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const initialGameViewStateRef = useRef(initialGameViewState);
  const initialUniverseRef = useRef<LifeUniverse>(
    cloneUniverse(initialGameViewState.universe),
  );
  const largestViewportBaseSpanRef = useRef(
    initialGameViewState.viewportBaseSpan,
  );
  const universeRef = useRef<LifeUniverse>(
    cloneUniverse(initialGameViewState.universe),
  );

  const [universe, setUniverse] = useState<LifeUniverse>(() =>
    cloneUniverse(initialGameViewState.universe),
  );
  const [generation, setGeneration] = useState(0);
  const [population, setPopulation] = useState(
    () => initialGameViewState.population,
  );
  const [copyFeedback, setCopyFeedback] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [shareFeedback, setShareFeedback] = useState<
    "idle" | "shared" | "copied" | "failed"
  >("idle");
  const [hasStartedOnce, setHasStartedOnce] = useState(false);
  const [hasLoadedTickDelayPreference, setHasLoadedTickDelayPreference] =
    useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isAutoZoomEnabled, setIsAutoZoomEnabled] = useState(true);
  const [tickDelayMs, setTickDelayMs] = useState(DEFAULT_TICK_DELAY_MS);
  const [zoomFactor, setZoomFactor] = useState(DEFAULT_ZOOM_FACTOR);

  const stopSimulation = useCallback(() => {
    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }

    setIsRunning(false);
  }, []);

  const clearCopyFeedbackTimer = useCallback(() => {
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
  }, []);

  const clearShareFeedbackTimer = useCallback(() => {
    if (shareFeedbackTimerRef.current) {
      window.clearTimeout(shareFeedbackTimerRef.current);
      shareFeedbackTimerRef.current = null;
    }
  }, []);

  const restoreInitialGameView = useCallback(
    (nextInitialGameViewState = initialGameViewStateRef.current) => {
      const nextUniverse = cloneUniverse(nextInitialGameViewState.universe);

      initialUniverseRef.current = cloneUniverse(
        nextInitialGameViewState.universe,
      );
      largestViewportBaseSpanRef.current =
        nextInitialGameViewState.viewportBaseSpan;
      universeRef.current = nextUniverse;
      setUniverse(nextUniverse);
      setIsAutoZoomEnabled(true);
      setZoomFactor(DEFAULT_ZOOM_FACTOR);
      setGeneration(0);
      setHasStartedOnce(false);
      setPopulation(nextInitialGameViewState.population);

      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      drawUniverse(
        canvas,
        nextUniverse,
        nextInitialGameViewState.viewportBaseSpan,
        nextInitialGameViewState.viewportCenter,
        DEFAULT_ZOOM_FACTOR,
      );
    },
    [],
  );

  const advanceLife = useCallback(() => {
    const nextUniverse = nextGeneration(universeRef.current);
    const nextPopulation = countPopulation(nextUniverse);

    universeRef.current = nextUniverse;
    setUniverse(nextUniverse);
    setGeneration((value) => value + 1);
    setPopulation(nextPopulation);

    if (nextPopulation === 0) {
      stopSimulation();
      setHasStartedOnce(false);
    }
  }, [stopSimulation]);

  const handleStart = useCallback(() => {
    setIsRunning((current) => {
      const nextRunningState = !current;

      if (nextRunningState) {
        setHasStartedOnce(true);
      }

      return nextRunningState;
    });
  }, []);

  const handleReset = useCallback(() => {
    onReset();
  }, [onReset]);

  const handleZoomIn = useCallback(() => {
    setIsAutoZoomEnabled(false);
    setZoomFactor((current) => current * ZOOM_STEP);
  }, []);

  const handleZoomOut = useCallback(() => {
    setIsAutoZoomEnabled(false);
    setZoomFactor((current) => current / ZOOM_STEP);
  }, []);

  const handleFit = useCallback(() => {
    setZoomFactor(DEFAULT_ZOOM_FACTOR);
    setIsAutoZoomEnabled(true);
  }, []);

  const handleSpeedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextSliderValue = Number(event.target.value);
      const nextTickDelayMs = clampTickDelayMs(
        MAX_TICK_DELAY_MS + MIN_TICK_DELAY_MS - nextSliderValue,
      );

      setTickDelayMs(nextTickDelayMs);
    },
    [],
  );

  const handleCopyQrValue = useCallback(async () => {
    if (!qrValue) {
      return;
    }

    clearCopyFeedbackTimer();

    try {
      await navigator.clipboard.writeText(qrValue);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("failed");
    }

    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback("idle");
      copyFeedbackTimerRef.current = null;
    }, 1800);
  }, [clearCopyFeedbackTimer, qrValue]);

  const handleShareCurrentUrl = useCallback(async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    clearShareFeedbackTimer();

    try {
      const currentUrl = window.location.href;

      if (typeof navigator.share === "function") {
        await navigator.share({ url: currentUrl });
        setShareFeedback("shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentUrl);
        setShareFeedback("copied");
      } else {
        setShareFeedback("failed");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareFeedback("idle");
        return;
      }

      setShareFeedback("failed");
    }

    shareFeedbackTimerRef.current = window.setTimeout(() => {
      setShareFeedback("idle");
      shareFeedbackTimerRef.current = null;
    }, 1800);
  }, [clearShareFeedbackTimer]);

  useEffect(() => {
    let nextTickDelayMs = DEFAULT_TICK_DELAY_MS;

    try {
      const storedTickDelayMs = window.localStorage.getItem(
        TICK_DELAY_STORAGE_KEY,
      );

      if (storedTickDelayMs !== null) {
        const parsedTickDelayMs = Number(storedTickDelayMs);

        if (Number.isFinite(parsedTickDelayMs)) {
          nextTickDelayMs = clampTickDelayMs(parsedTickDelayMs);
        }
      }
    } catch {}

    setTickDelayMs(nextTickDelayMs);
    setHasLoadedTickDelayPreference(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedTickDelayPreference) {
      return;
    }

    try {
      window.localStorage.setItem(
        TICK_DELAY_STORAGE_KEY,
        String(clampTickDelayMs(tickDelayMs)),
      );
    } catch {}
  }, [hasLoadedTickDelayPreference, tickDelayMs]);

  useEffect(() => {
    stopSimulation();
    clearCopyFeedbackTimer();
    clearShareFeedbackTimer();
    const nextInitialGameViewState = createInitialGameViewState(seed);

    initialGameViewStateRef.current = nextInitialGameViewState;
    setCopyFeedback("idle");
    setShareFeedback("idle");
    restoreInitialGameView(nextInitialGameViewState);
  }, [
    clearCopyFeedbackTimer,
    clearShareFeedbackTimer,
    restoreInitialGameView,
    seed,
    stopSimulation,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const nextSeedViewportCenter =
      initialGameViewStateRef.current.viewportCenter;
    const nextViewportBaseSpan = getViewportBaseSpan(
      universe,
      initialUniverseRef.current,
      nextSeedViewportCenter,
    );

    if (isAutoZoomEnabled) {
      largestViewportBaseSpanRef.current = Math.max(
        largestViewportBaseSpanRef.current,
        nextViewportBaseSpan,
      );
    }

    drawUniverse(
      canvas,
      universe,
      largestViewportBaseSpanRef.current,
      nextSeedViewportCenter,
      zoomFactor,
    );
  }, [isAutoZoomEnabled, universe, zoomFactor]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    simulationTimerRef.current = window.setInterval(advanceLife, tickDelayMs);

    return () => {
      if (simulationTimerRef.current) {
        window.clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [advanceLife, isRunning, tickDelayMs]);

  useEffect(() => {
    return () => {
      clearCopyFeedbackTimer();
      clearShareFeedbackTimer();
      stopSimulation();
    };
  }, [clearCopyFeedbackTimer, clearShareFeedbackTimer, stopSimulation]);

  const speedSliderValue = MAX_TICK_DELAY_MS + MIN_TICK_DELAY_MS - tickDelayMs;
  const copyButtonLabel =
    copyFeedback === "copied"
      ? "Copied"
      : copyFeedback === "failed"
        ? "Retry"
        : "Copy";
  const CopyButtonIcon =
    copyFeedback === "copied" ? RiCheckLine : RiFileCopyLine;
  const canShareCurrentUrl =
    typeof navigator !== "undefined" &&
    (typeof navigator.share === "function" ||
      typeof navigator.clipboard?.writeText === "function");
  const shareButtonLabel =
    shareFeedback === "shared"
      ? "Shared"
      : shareFeedback === "copied"
        ? "Link copied"
        : shareFeedback === "failed"
          ? "Retry"
          : canShareCurrentUrl
            ? "Share"
            : "Sharing unavailable";
  const ShareButtonIcon =
    shareFeedback === "shared" || shareFeedback === "copied"
      ? RiCheckLine
      : RiShareLine;
  const startButtonLabel = isRunning
    ? "Pause"
    : hasStartedOnce
      ? "Resume"
      : "Start";

  return (
    <div className="space-y-4">
      <div className="rounded-[1.75rem] border border-cyan-300/14 bg-linear-[180deg,rgba(10,18,34,0.95),rgba(5,10,20,0.95)] p-4">
        <div className="space-y-4">
          <div className="relative overflow-hidden border border-cyan-300/14 bg-[#020617] p-1">
            <canvas ref={canvasRef} className="aspect-square w-full" />

            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 flex flex-col items-center gap-0.5 rounded-xl border border-white/12 bg-slate-950 px-2.5 pt-2 pb-1 sm:flex-row sm:items-baseline sm:gap-2 sm:rounded-full sm:px-3 sm:py-1">
              <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
                Gen
              </span>
              <span className="font-mono text-sm text-white sm:text-base lg:text-lg">
                {generation}
              </span>
            </div>

            <div className="absolute top-2 sm:top-4 right-2 sm:right-4 flex flex-col items-center gap-0.5 rounded-xl border border-white/12 bg-slate-950 px-2.5 pt-2 pb-1 sm:flex-row sm:items-baseline sm:gap-2 sm:rounded-full sm:px-3 sm:py-1">
              <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
                Cells
              </span>
              <span className="font-mono text-sm text-cyan-200 sm:text-base lg:text-lg">
                {population}
              </span>
            </div>

            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 rounded-xl border border-white/12 sm:rounded-full bg-slate-950 p-1.5 pb-3 sm:pl-3 sm:pr-2.5 lg:pr-3 sm:py-2 lg:py-3">
              <label className="flex flex-col items-center gap-2 sm:flex-row">
                <span className="text-[0.6rem] sm:text-xs lg:text-sm font-medium uppercase tracking-[0.24em] text-slate-200/80">
                  Speed
                </span>
                <input
                  type="range"
                  min={MIN_TICK_DELAY_MS}
                  max={MAX_TICK_DELAY_MS}
                  step={20}
                  value={speedSliderValue}
                  onChange={handleSpeedChange}
                  className="h-1.5 w-20 sm:w-28 cursor-pointer accent-cyan-300"
                  aria-label="Simulation speed"
                />
              </label>
            </div>

            <div className="absolute right-2 sm:right-4 bottom-2 sm:bottom-4 flex flex-col items-center gap-1 rounded-xl border border-white/12 bg-slate-950 p-1.5 sm:flex-row sm:gap-2 sm:rounded-full sm:pl-3 sm:pr-1.5 lg:pr-2 sm:py-1 lg:py-1.5">
              <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
                Zoom
              </span>
              <div className="inline-flex items-center gap-1">
                <Button
                  type="button"
                  onClick={handleZoomOut}
                  variant="quiet"
                  className="size-6 lg:size-8 rounded-full bg-slate-900/82 text-xl lg:text-2xl leading-none font-semibold hover:bg-slate-800/88"
                >
                  -
                </Button>
                <Button
                  type="button"
                  onClick={handleZoomIn}
                  variant="quiet"
                  className="size-6 lg:size-8 rounded-full bg-slate-900/82 text-xl lg:text-2xl leading-none font-semibold hover:bg-slate-800/88"
                >
                  +
                </Button>
                <Button
                  type="button"
                  onClick={handleFit}
                  variant="quiet"
                  aria-pressed={isAutoZoomEnabled}
                  className="size-6 lg:size-8 rounded-full bg-slate-900/82 text-[0.5rem] lg:text-xs leading-none font-semibold uppercase tracking-[0.08em] text-slate-200/80 hover:bg-slate-800/88"
                >
                  Fit
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleStart}
              variant="aurora"
              className="h-auto px-5 py-2.5 text-sm font-semibold"
            >
              {startButtonLabel}
            </Button>

            <Button
              type="button"
              onClick={handleReset}
              variant="glass"
              className="h-auto px-5 py-2.5 text-sm font-semibold"
            >
              Reset
            </Button>

            <Button
              type="button"
              onClick={onScanAnother}
              variant="quiet"
              className="h-auto px-5 py-2.5 text-sm font-semibold"
            >
              New
            </Button>

            <div className="relative min-w-40 max-w-80 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5">
              <p className="truncate pr-10 font-mono text-xs leading-6 text-slate-300">
                {qrValue ?? "No QR captured yet."}
              </p>
              <div className="absolute inset-y-0 right-2 flex items-center">
                <Button
                  type="button"
                  onClick={handleCopyQrValue}
                  variant="quiet"
                  className="h-8 min-w-8 rounded-full bg-slate-900/88 px-0 text-slate-200 hover:bg-slate-800"
                  disabled={!qrValue}
                  aria-label={copyButtonLabel}
                  title={copyButtonLabel}
                >
                  <CopyButtonIcon className="size-4" />
                </Button>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleShareCurrentUrl}
              variant="quiet"
              className="size-11 shrink-0 rounded-full border-white/10 bg-slate-950/70 text-slate-200 hover:bg-slate-900/88"
              disabled={!canShareCurrentUrl}
              aria-label={shareButtonLabel}
              title={shareButtonLabel}
            >
              <ShareButtonIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GameOfLife({ onScanAnother, qrValue, seed }: Props) {
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <GameOfLifeSession
      key={sessionKey}
      onReset={() => {
        setSessionKey((current) => current + 1);
      }}
      onScanAnother={onScanAnother}
      qrValue={qrValue}
      seed={seed}
    />
  );
}
