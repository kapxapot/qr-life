"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  countPopulation,
  type LifeGrid,
  nextGeneration,
} from "@/lib/game-of-life";

const CANVAS_CELL_SIZE = 16;

type Props = {
  onScanAnother: () => void;
  qrValue: string | null;
  seed: LifeGrid;
};

function truncateValue(value: string) {
  if (value.length <= 84) {
    return value;
  }

  return `${value.slice(0, 84)}...`;
}

function cloneGrid(grid: LifeGrid): LifeGrid {
  return grid.map((row) => [...row]);
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

export function GameOfLife({ onScanAnother, qrValue, seed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const initialGridRef = useRef<LifeGrid>(cloneGrid(seed));
  const gridRef = useRef<LifeGrid>(cloneGrid(seed));

  const [grid, setGrid] = useState<LifeGrid>(() => cloneGrid(seed));
  const [generation, setGeneration] = useState(0);
  const [population, setPopulation] = useState(() => countPopulation(seed));
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "QR captured. This is its first Life state.",
  );

  const stopSimulation = useCallback(() => {
    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }

    setIsRunning(false);
  }, []);

  const advanceLife = useCallback(() => {
    const currentGrid = gridRef.current;
    const nextGrid = nextGeneration(currentGrid);
    const nextPopulation = countPopulation(nextGrid);

    gridRef.current = nextGrid;
    setGrid(nextGrid);
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
          ? "The colony is evolving."
          : "Simulation paused at the current generation.",
      );

      return nextRunningState;
    });
  }, []);

  const handleReset = useCallback(() => {
    stopSimulation();

    const nextGrid = cloneGrid(initialGridRef.current);

    gridRef.current = nextGrid;
    setGrid(nextGrid);
    setGeneration(0);
    setPopulation(countPopulation(nextGrid));
    setStatusMessage(
      "Back to the scanned seed. Start it again whenever you want.",
    );
  }, [stopSimulation]);

  useEffect(() => {
    stopSimulation();

    const nextGrid = cloneGrid(seed);

    initialGridRef.current = cloneGrid(seed);
    gridRef.current = nextGrid;
    setGrid(nextGrid);
    setGeneration(0);
    setPopulation(countPopulation(nextGrid));
    setStatusMessage("QR captured. This is its first Life state.");
  }, [seed, stopSimulation]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    drawGrid(canvas, grid);
  }, [grid]);

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
              <button
                type="button"
                onClick={handleStart}
                className="rounded-full border border-cyan-200/20 bg-linear-to-r from-cyan-400 via-emerald-300 to-fuchsia-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_-20px_rgba(34,211,238,0.85)] transition-transform duration-200 hover:-translate-y-0.5"
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
                onClick={onScanAnother}
                className="rounded-full border border-white/12 bg-transparent px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors duration-200 hover:border-cyan-200/30 hover:text-white"
              >
                Scan another QR
              </button>
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
