import { RiDeleteBinLine } from "@remixicon/react";
import type { ChangeEvent } from "react";
import { GameOfLifeDebugPanel } from "@/components/game-of-life/game-of-life-debug-panel";
import {
  type GameOfLifeInteractionMode,
  GameOfLifeModeSwitch,
} from "@/components/game-of-life/game-of-life-mode-switch";
import { Button } from "@/components/ui/button";
import type { LifeDebugSnapshot } from "@/lib/game-of-life/game-of-life-debug";

type Props = {
  debugSnapshot: LifeDebugSnapshot | null;
  generation: number;
  interactionMode: GameOfLifeInteractionMode;
  interactionDebugLines: string[];
  isAutoZoomEnabled: boolean;
  isRunning: boolean;
  onClear: () => void;
  onFit: () => void;
  onInteractionModeChange: (nextMode: GameOfLifeInteractionMode) => void;
  onSpeedChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  population: number;
  speedSliderMax: number;
  speedSliderMin: number;
  speedSliderStep: number;
  speedSliderValue: number;
};

export function GameOfLifeCanvasOverlay({
  debugSnapshot,
  generation,
  interactionMode,
  interactionDebugLines,
  isAutoZoomEnabled,
  isRunning,
  onClear,
  onFit,
  onInteractionModeChange,
  onSpeedChange,
  onZoomIn,
  onZoomOut,
  population,
  speedSliderMax,
  speedSliderMin,
  speedSliderStep,
  speedSliderValue,
}: Props) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4 lg:justify-end">
        {debugSnapshot && (
          <div className="pointer-events-auto">
            <GameOfLifeDebugPanel
              debugSnapshot={debugSnapshot}
              interactionDebugLines={interactionDebugLines}
            />
          </div>
        )}

        <div className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-xl border border-white/12 bg-slate-950 px-2.5 pt-2 pb-1 sm:flex-row sm:items-baseline sm:gap-2 sm:rounded-full sm:px-3 sm:py-1">
          <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
            Gen
          </span>
          <span className="font-mono text-sm text-white sm:text-base lg:text-lg">
            {generation}
          </span>
        </div>

        <div className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-xl border border-white/12 bg-slate-950 px-2.5 pt-2 pb-1 sm:flex-row sm:items-baseline sm:gap-2 sm:rounded-full sm:px-3 sm:py-1">
          <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
            Cells
          </span>
          <span className="font-mono text-sm text-cyan-200 sm:text-base lg:text-lg">
            {population}
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2 sm:inset-x-4 sm:bottom-4 lg:justify-end">
        <div className="pointer-events-auto rounded-xl border border-white/12 bg-slate-950 p-1.5 pb-3 sm:rounded-full sm:py-2 sm:pl-3 sm:pr-2.5 lg:py-3 lg:pr-3">
          <label className="flex flex-col items-center gap-2 sm:flex-row">
            <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
              Speed
            </span>
            <input
              type="range"
              min={speedSliderMin}
              max={speedSliderMax}
              step={speedSliderStep}
              value={speedSliderValue}
              onChange={onSpeedChange}
              className="h-1.5 w-20 sm:w-28 cursor-pointer accent-cyan-300"
              aria-label="Simulation speed"
            />
          </label>
        </div>

        <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-xl border border-white/12 bg-slate-950 p-1.5 sm:flex-row sm:gap-2 sm:rounded-full sm:py-1 sm:pl-3 sm:pr-1.5 lg:py-1.5 lg:pr-2">
          <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
            Zoom
          </span>
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              onClick={onZoomOut}
              variant="quiet"
              className="size-6 rounded-full bg-slate-900/82 text-xl leading-none font-semibold hover:bg-slate-800/88 lg:size-8 lg:text-2xl"
            >
              -
            </Button>
            <Button
              type="button"
              onClick={onZoomIn}
              variant="quiet"
              className="size-6 rounded-full bg-slate-900/82 text-xl leading-none font-semibold hover:bg-slate-800/88 lg:size-8 lg:text-2xl"
            >
              +
            </Button>
            <Button
              type="button"
              onClick={onFit}
              variant="quiet"
              aria-pressed={isAutoZoomEnabled}
              className="size-6 rounded-full bg-slate-900/82 text-[0.5rem] leading-none font-semibold uppercase tracking-[0.08em] text-slate-200/80 hover:bg-slate-800/88 lg:size-8 lg:text-xs"
            >
              Fit
            </Button>
          </div>
        </div>
      </div>

      {!isRunning && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-4">
          <div className="pointer-events-auto">
            <GameOfLifeModeSwitch
              interactionMode={interactionMode}
              onInteractionModeChange={onInteractionModeChange}
            />
          </div>
          <Button
            type="button"
            variant="glass"
            size="icon"
            aria-label="Clear cells"
            disabled={interactionMode !== "edit"}
            onClick={onClear}
            className="pointer-events-auto size-7 sm:size-11"
          >
            <RiDeleteBinLine className="size-4 sm:size-6" />
          </Button>
        </div>
      )}
    </>
  );
}
