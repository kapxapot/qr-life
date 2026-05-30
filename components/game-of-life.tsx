"use client";

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
const VIEWPORT_PADDING = 6;

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

function truncateValue(value: string) {
  if (value.length <= 84) {
    return value;
  }

  return `${value.slice(0, 84)}...`;
}

function createSeedUniverse(seed: LifeGrid): LifeUniverse {
  return createUniverseFromSeed(seed);
}

function buildViewport(
  universe: LifeUniverse,
  fallbackUniverse: LifeUniverse,
): Viewport {
  const boundsSource = universe.size > 0 ? universe : fallbackUniverse;
  const bounds = getUniverseBounds(boundsSource);

  if (!bounds) {
    return {
      minX: -Math.floor(MIN_VIEWPORT_SPAN / 2),
      minY: -Math.floor(MIN_VIEWPORT_SPAN / 2),
      span: MIN_VIEWPORT_SPAN,
    };
  }

  const minX = bounds.minX - VIEWPORT_PADDING;
  const maxX = bounds.maxX + VIEWPORT_PADDING;
  const minY = bounds.minY - VIEWPORT_PADDING;
  const maxY = bounds.maxY + VIEWPORT_PADDING;
  let span = Math.max(MIN_VIEWPORT_SPAN, maxX - minX + 1, maxY - minY + 1);

  if (span % 2 === 0) {
    span += 1;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const halfSpan = (span - 1) / 2;

  return {
    minX: Math.floor(centerX - halfSpan),
    minY: Math.floor(centerY - halfSpan),
    span,
  };
}

function drawUniverse(
  canvas: HTMLCanvasElement,
  universe: LifeUniverse,
  fallbackUniverse: LifeUniverse,
) {
  const viewport = buildViewport(universe, fallbackUniverse);
  const canvasSize = viewport.span * CANVAS_CELL_SIZE;

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

      context.fillStyle = "#0f172a";
      context.fillRect(
        x + 1,
        y + 1,
        CANVAS_CELL_SIZE - 2,
        CANVAS_CELL_SIZE - 2,
      );

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
      context.fillRect(
        x + 1.75,
        y + 1.75,
        CANVAS_CELL_SIZE - 3.5,
        CANVAS_CELL_SIZE - 3.5,
      );
    }
  }
}

export function GameOfLife({ onScanAnother, qrValue, seed }: Props) {
  const seedUniverse = createSeedUniverse(seed);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const initialUniverseRef = useRef<LifeUniverse>(cloneUniverse(seedUniverse));
  const universeRef = useRef<LifeUniverse>(cloneUniverse(seedUniverse));

  const [universe, setUniverse] = useState<LifeUniverse>(() =>
    cloneUniverse(seedUniverse),
  );
  const [generation, setGeneration] = useState(0);
  const [population, setPopulation] = useState(() =>
    countPopulation(seedUniverse),
  );
  const [isRunning, setIsRunning] = useState(false);
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

  const advanceLife = useCallback(() => {
    const nextUniverse = nextGeneration(universeRef.current);
    const nextPopulation = countPopulation(nextUniverse);

    universeRef.current = nextUniverse;
    setUniverse(nextUniverse);
    setGeneration((value) => value + 1);
    setPopulation(nextPopulation);

    if (nextPopulation === 0) {
      stopSimulation();
      setStatusMessage("The colony faded out. Scan another QR to try again.");
    }
  }, [stopSimulation]);

  const handleStart = useCallback(() => {
    setIsRunning((current) => {
      const nextRunningState = !current;

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

    universeRef.current = nextUniverse;
    setUniverse(nextUniverse);
    setGeneration(0);
    setPopulation(countPopulation(nextUniverse));
    setStatusMessage("Back to the centered scanned seed.");
  }, [stopSimulation]);

  useEffect(() => {
    stopSimulation();

    const nextUniverse = createSeedUniverse(seed);

    initialUniverseRef.current = cloneUniverse(nextUniverse);
    universeRef.current = cloneUniverse(nextUniverse);
    setUniverse(nextUniverse);
    setGeneration(0);
    setPopulation(countPopulation(nextUniverse));
    setStatusMessage("QR captured. It's centered on an endless Life field.");
  }, [seed, stopSimulation]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    drawUniverse(canvas, universe, initialUniverseRef.current);
  }, [universe]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    simulationTimerRef.current = window.setInterval(advanceLife, 180);

    return () => {
      if (simulationTimerRef.current) {
        window.clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [advanceLife, isRunning]);

  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, [stopSimulation]);

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

            <div className="overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-[#020617] p-3">
              <canvas
                ref={canvasRef}
                className="aspect-square w-full rounded-2xl"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleStart}
                variant="aurora"
                className="h-auto px-5 py-2.5 text-sm font-semibold"
              >
                {isRunning ? "Pause" : "Start"}
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
          <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-xs leading-6 text-slate-300">
            {qrValue ? truncateValue(qrValue) : "No QR captured yet."}
          </p>
        </div>
      </aside>
    </div>
  );
}
