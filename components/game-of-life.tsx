"use client";

import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cloneUniverse,
  countPopulation,
  createUniverseFromSeed,
  getUniverseBounds,
  hasLiveCell,
  type LifeGrid,
  type LifeUniverse,
  nextGeneration,
} from "@/lib/game-of-life";

const CANVAS_CELL_SIZE = 14;
const MIN_VIEWPORT_SPAN = 41;
const MIN_ZOOMED_VIEWPORT_SPAN = 9;
const VIEWPORT_PADDING = 6;
const DEFAULT_ZOOM_FACTOR = 1;
const DEFAULT_TICK_DELAY_MS = 180;
const ZOOM_STEP = 1.25;
const MIN_ZOOM_FACTOR = 0.5;
const MAX_ZOOM_FACTOR = 3;
const MIN_TICK_DELAY_MS = 60;
const MAX_TICK_DELAY_MS = 420;

type Props = {
  onScanAnother: () => void;
  qrValue: string | null;
  seed: LifeGrid;
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

function truncateValue(value: string) {
  if (value.length <= 84) {
    return value;
  }

  return `${value.slice(0, 84)}...`;
}

function createSeedUniverse(seed: LifeGrid): LifeUniverse {
  return createUniverseFromSeed(seed);
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

function createViewport(
  center: ViewportCenter,
  span: number,
): Viewport {
  const halfSpan = (span - 1) / 2;

  return {
    minX: Math.floor(center.x - halfSpan),
    minY: Math.floor(center.y - halfSpan),
    span,
  };
}

function normalizeViewportSpan(
  span: number,
  center: ViewportCenter,
): number {
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
    Math.max(
      MIN_VIEWPORT_SPAN,
      Math.ceil(furthestEdgeDistance * 2 + 1),
    ),
    center,
  );
}

function buildViewport(
  baseSpan: number,
  center: ViewportCenter,
  zoomFactor: number,
): Viewport {
  const span = normalizeViewportSpan(
    Math.max(MIN_ZOOMED_VIEWPORT_SPAN, baseSpan / zoomFactor),
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
  const canvasSize = viewport.span * CANVAS_CELL_SIZE;
  const displayCellSize =
    canvas.clientWidth > 0 ? canvas.clientWidth / viewport.span : CANVAS_CELL_SIZE;
  const showGridLines = displayCellSize > 1;

  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvasSize, canvasSize);
  context.fillStyle = "#030712";
  context.fillRect(0, 0, canvasSize, canvasSize);

  for (let rowIndex = 0; rowIndex < viewport.span; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < viewport.span; columnIndex += 1) {
      const x = columnIndex * CANVAS_CELL_SIZE;
      const y = rowIndex * CANVAS_CELL_SIZE;
      const worldX = viewport.minX + columnIndex;
      const worldY = viewport.minY + rowIndex;

      if (showGridLines) {
        context.fillStyle = "#0f172a";
        context.fillRect(
          x + 1,
          y + 1,
          CANVAS_CELL_SIZE - 2,
          CANVAS_CELL_SIZE - 2,
        );
      }

      if (!hasLiveCell(universe, worldX, worldY)) {
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

      if (showGridLines) {
        context.fillRect(
          x + 1.75,
          y + 1.75,
          CANVAS_CELL_SIZE - 3.5,
          CANVAS_CELL_SIZE - 3.5,
        );
        continue;
      }

      context.fillRect(x, y, CANVAS_CELL_SIZE, CANVAS_CELL_SIZE);
    }
  }
}

export function GameOfLife({ onScanAnother, qrValue, seed }: Props) {
  const seedUniverse = createSeedUniverse(seed);
  const seedViewportBaseSpan = getViewportBaseSpan(
    seedUniverse,
    seedUniverse,
    getSeedViewportCenter(seed),
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const initialUniverseRef = useRef<LifeUniverse>(cloneUniverse(seedUniverse));
  const largestViewportBaseSpanRef = useRef(seedViewportBaseSpan);
  const universeRef = useRef<LifeUniverse>(cloneUniverse(seedUniverse));

  const [universe, setUniverse] = useState<LifeUniverse>(() =>
    cloneUniverse(seedUniverse),
  );
  const [generation, setGeneration] = useState(0);
  const [population, setPopulation] = useState(() =>
    countPopulation(seedUniverse),
  );
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [hasStartedOnce, setHasStartedOnce] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [tickDelayMs, setTickDelayMs] = useState(DEFAULT_TICK_DELAY_MS);
  const [zoomFactor, setZoomFactor] = useState(DEFAULT_ZOOM_FACTOR);
  const [statusMessage, setStatusMessage] = useState(
    "QR captured. It's centered on an endless Life field.",
  );

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
      setStatusMessage("The colony faded out. Scan another QR to try again.");
    }
  }, [stopSimulation]);

  const handleStart = useCallback(() => {
    setIsRunning((current) => {
      const nextRunningState = !current;

      if (nextRunningState) {
        setHasStartedOnce(true);
      }

      setStatusMessage(
        nextRunningState
          ? "The colony is evolving across the field."
          : "Simulation paused at the current generation.",
      );

      return nextRunningState;
    });
  }, []);

  const handleReset = useCallback(() => {
    stopSimulation();

    const nextUniverse = cloneUniverse(initialUniverseRef.current);
    const nextSeedViewportCenter = getSeedViewportCenter(seed);
    const nextViewportBaseSpan = getViewportBaseSpan(
      nextUniverse,
      nextUniverse,
      nextSeedViewportCenter,
    );

    largestViewportBaseSpanRef.current = nextViewportBaseSpan;
    universeRef.current = nextUniverse;
    setUniverse(nextUniverse);
    setGeneration(0);
    setHasStartedOnce(false);
    setPopulation(countPopulation(nextUniverse));
    setStatusMessage("Back to the centered scanned seed.");
  }, [seed, stopSimulation]);

  const handleZoomIn = useCallback(() => {
    setZoomFactor((current) =>
      Math.min(MAX_ZOOM_FACTOR, Number((current * ZOOM_STEP).toFixed(4))),
    );
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomFactor((current) =>
      Math.max(MIN_ZOOM_FACTOR, Number((current / ZOOM_STEP).toFixed(4))),
    );
  }, []);

  const handleSpeedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextSliderValue = Number(event.target.value);
      const nextTickDelayMs =
        MAX_TICK_DELAY_MS + MIN_TICK_DELAY_MS - nextSliderValue;

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

  useEffect(() => {
    stopSimulation();
    clearCopyFeedbackTimer();

    const nextUniverse = createSeedUniverse(seed);
    const nextSeedViewportCenter = getSeedViewportCenter(seed);
    const nextViewportBaseSpan = getViewportBaseSpan(
      nextUniverse,
      nextUniverse,
      nextSeedViewportCenter,
    );

    initialUniverseRef.current = cloneUniverse(nextUniverse);
    largestViewportBaseSpanRef.current = nextViewportBaseSpan;
    universeRef.current = cloneUniverse(nextUniverse);
    setUniverse(nextUniverse);
    setGeneration(0);
    setHasStartedOnce(false);
    setPopulation(countPopulation(nextUniverse));
    setCopyFeedback("idle");
    setTickDelayMs(DEFAULT_TICK_DELAY_MS);
    setZoomFactor(DEFAULT_ZOOM_FACTOR);
    setStatusMessage("QR captured. It's centered on an endless Life field.");
  }, [clearCopyFeedbackTimer, seed, stopSimulation]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const nextSeedViewportCenter = getSeedViewportCenter(seed);
    const nextViewportBaseSpan = getViewportBaseSpan(
      universe,
      initialUniverseRef.current,
      nextSeedViewportCenter,
    );

    largestViewportBaseSpanRef.current = Math.max(
      largestViewportBaseSpanRef.current,
      nextViewportBaseSpan,
    );

    drawUniverse(
      canvas,
      universe,
      largestViewportBaseSpanRef.current,
      nextSeedViewportCenter,
      zoomFactor,
    );
  }, [seed, universe, zoomFactor]);

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
      stopSimulation();
    };
  }, [clearCopyFeedbackTimer, stopSimulation]);

  const isZoomedInAtLimit = zoomFactor >= MAX_ZOOM_FACTOR;
  const isZoomedOutAtLimit = zoomFactor <= MIN_ZOOM_FACTOR;
  const speedSliderValue =
    MAX_TICK_DELAY_MS + MIN_TICK_DELAY_MS - tickDelayMs;
  const copyButtonLabel =
    copyFeedback === "copied"
      ? "Copied"
      : copyFeedback === "failed"
        ? "Retry"
        : "Copy";
  const CopyButtonIcon =
    copyFeedback === "copied" ? RiCheckLine : RiFileCopyLine;
  const startButtonLabel = isRunning
    ? "Pause"
    : hasStartedOnce
      ? "Resume"
      : "Start";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <div className="rounded-[1.75rem] border border-cyan-300/14 bg-linear-[180deg,rgba(10,18,34,0.95),rgba(5,10,20,0.95)] p-4">
          <div className="space-y-4">
            <div className="px-1">
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
                Game Of Life
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {statusMessage}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-[#020617] p-3">
              <canvas
                ref={canvasRef}
                className="aspect-square w-full rounded-2xl"
              />

              <div className="absolute bottom-6 left-6 rounded-full bg-slate-950/72 px-3 py-2 backdrop-blur">
                <label className="flex items-center gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-200/80">
                    Speed
                  </span>
                  <input
                    type="range"
                    min={MIN_TICK_DELAY_MS}
                    max={MAX_TICK_DELAY_MS}
                    step={20}
                    value={speedSliderValue}
                    onChange={handleSpeedChange}
                    className="h-1.5 w-28 cursor-pointer accent-cyan-300"
                    aria-label="Simulation speed"
                  />
                </label>
              </div>

              <div className="absolute right-6 bottom-6 inline-flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleZoomOut}
                  variant="quiet"
                  className="h-9 min-w-9 rounded-full bg-slate-950/72 px-3 text-xl leading-none font-semibold hover:bg-slate-900/82"
                  disabled={isZoomedOutAtLimit}
                >
                  -
                </Button>
                <Button
                  type="button"
                  onClick={handleZoomIn}
                  variant="quiet"
                  className="h-9 min-w-9 rounded-full bg-slate-950/72 px-3 text-xl leading-none font-semibold hover:bg-slate-900/82"
                  disabled={isZoomedInAtLimit}
                >
                  +
                </Button>
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
                Scan another QR
              </Button>
            </div>
          </div>
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
          <div className="relative mt-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
            <p className="pr-12 font-mono text-xs leading-6 text-slate-300">
              {qrValue ? truncateValue(qrValue) : "No QR captured yet."}
            </p>
            <div className="absolute inset-y-0 right-3 flex items-center">
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
        </div>
      </aside>
    </div>
  );
}
