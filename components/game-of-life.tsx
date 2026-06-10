"use client";

import { RiCheckLine, RiFileCopyLine, RiShareLine } from "@remixicon/react";
import type {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameOfLifeDebugPanel } from "@/components/game-of-life-debug-panel";
import { Button } from "@/components/ui/button";
import {
  cloneUniverse,
  countPopulation,
  createUniverseFromSeed,
  getAutofitUniverse,
  getFreeFlyingGliderCells,
  getUniverseBounds,
  type LifeGrid,
  type LifeUniverse,
  nextGeneration,
  type UniverseBounds,
} from "@/lib/game-of-life";
import {
  createLifeDebugSnapshot,
  type LifeDebugSnapshot,
} from "@/lib/game-of-life-debug";
import {
  getRequiredViewportBaseSpanForBounds,
  getViewportCenterForBounds,
  getViewportSpans,
  normalizeViewportSpanForAxis,
} from "@/lib/game-of-life-viewport";

const CANVAS_CELL_SIZE = 14;
const GRIDLINE_CELL_INSET = 1;
const LIVE_CELL_INSET = 1.75;
const GRID_INSET_START_RATIO = 0.8;
const GRID_INSET_END_RATIO = 1.6;
const MIN_VISIBLE_LIVE_CELL_GAP_DEVICE_PIXELS = 2;
const LIVE_CELL_COLOR = "#67e8f9";
const GLIDER_CELL_COLOR = "#fbbf24";
const DEBUG_AUTOFIT_BOUNDS_COLOR = "#f43f5e";
const DEBUG_UNIVERSE_BOUNDS_COLOR = "#22c55e";
const DEBUG_AUTOFIT_EDGE_COLOR = "#f8fafc";
const MIN_VIEWPORT_SPAN = 41;
const INITIAL_VIEWPORT_PADDING = 6;
const AUTO_FIT_VIEWPORT_PADDING = 5;
// Keep a little extra breathing room around the initial view so the
// scanned QR doesn't start edge-to-edge in the viewport.
const INITIAL_FIT_ZOOM_FACTOR = 0.9;
const AUTO_FIT_ZOOM_FACTOR = 1;
const LARGE_SCREEN_MEDIA_QUERY = "(min-width: 64rem)";
const DEFAULT_TICK_DELAY_MS = 200;
const ZOOM_STEP = 1.25;
const MIN_ZOOM_FACTOR = 0.125;
const MAX_ZOOM_FACTOR = 64;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const MIN_TICK_DELAY_MS = 0;
const MAX_TICK_DELAY_MS = 400;
const TICK_DELAY_STORAGE_KEY = "qr-life:game-of-life:tick-delay-ms";
const RESIZE_REDRAW_DEBOUNCE_MS = 80;

type Props = {
  debug?: boolean;
  onScanAnother: () => void;
  qrValue: string | null;
  seed: LifeGrid;
};

type SessionProps = Props & {
  onReset: () => void;
};

type Viewport = {
  center: ViewportCenter;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  spanX: number;
  spanY: number;
};

type ViewportCenter = {
  x: number;
  y: number;
};

type RedrawOptions = {
  gliderCells?: LifeUniverse;
  isAutoZoomEnabled?: boolean;
  universe?: LifeUniverse;
  viewportCenter?: ViewportCenter;
  zoomFactor?: number;
};

type InitialGameViewState = {
  gliderCells: LifeUniverse;
  population: number;
  universe: LifeUniverse;
  viewportBaseSpan: number;
  viewportCenter: ViewportCenter;
};

type CanvasViewportMetrics = {
  canvasRect: DOMRect;
  displayCellSize: number;
  renderedCanvasHeight: number;
  renderedCanvasWidth: number;
  viewport: Viewport;
};

type PointerCoordinates = {
  clientX: number;
  clientY: number;
};

type PinchGesture = {
  centerX: number;
  centerY: number;
  distance: number;
};

function clampTickDelayMs(value: number) {
  return Math.min(MAX_TICK_DELAY_MS, Math.max(MIN_TICK_DELAY_MS, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampZoomFactor(value: number) {
  return clamp(value, MIN_ZOOM_FACTOR, MAX_ZOOM_FACTOR);
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

function getInitialFitZoomFactor() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia(LARGE_SCREEN_MEDIA_QUERY).matches
  ) {
    return INITIAL_FIT_ZOOM_FACTOR / ZOOM_STEP;
  }

  return INITIAL_FIT_ZOOM_FACTOR;
}

function getInitialViewportBaseSpan(viewportBaseSpan: number) {
  return normalizeSquareViewportSpan(
    viewportBaseSpan / getInitialFitZoomFactor(),
  );
}

function createInitialGameViewState(seed: LifeGrid): InitialGameViewState {
  const universe = createUniverseFromSeed(seed);
  const gliderCells = getFreeFlyingGliderCells(universe);
  const autofitUniverse = getAutofitUniverse(universe, gliderCells);
  const viewportCenter = getSeedViewportCenter(seed);
  const viewportBaseSpan = getViewportBaseSpan(
    autofitUniverse.size > 0 ? autofitUniverse : universe,
    universe,
    viewportCenter,
    INITIAL_VIEWPORT_PADDING,
  );

  return {
    gliderCells,
    population: countPopulation(universe),
    universe,
    viewportBaseSpan: getInitialViewportBaseSpan(viewportBaseSpan),
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

function createViewport(
  center: ViewportCenter,
  spanX: number,
  spanY: number,
): Viewport {
  const halfSpanX = (spanX - 1) / 2;
  const halfSpanY = (spanY - 1) / 2;

  return {
    center,
    maxX: center.x + halfSpanX,
    maxY: center.y + halfSpanY,
    minX: center.x - halfSpanX,
    minY: center.y - halfSpanY,
    spanX,
    spanY,
  };
}

function parseCellKey(key: string): ViewportCenter {
  const [xValue = "0", yValue = "0"] = key.split(":");

  return {
    x: Number(xValue),
    y: Number(yValue),
  };
}

function normalizeSquareViewportSpan(span: number): number {
  return normalizeViewportSpanForAxis(span);
}

function getPaddedUniverseBounds(
  universe: LifeUniverse,
  fallbackUniverse: LifeUniverse,
  viewportPadding: number,
): UniverseBounds | null {
  const boundsSource = universe.size > 0 ? universe : fallbackUniverse;
  const bounds = getUniverseBounds(boundsSource);

  if (!bounds) {
    return null;
  }

  return {
    maxX: bounds.maxX + viewportPadding,
    maxY: bounds.maxY + viewportPadding,
    minX: bounds.minX - viewportPadding,
    minY: bounds.minY - viewportPadding,
  };
}

function getViewportBaseSpan(
  universe: LifeUniverse,
  fallbackUniverse: LifeUniverse,
  center: ViewportCenter,
  viewportPadding: number,
): number {
  const paddedBounds = getPaddedUniverseBounds(
    universe,
    fallbackUniverse,
    viewportPadding,
  );

  if (!paddedBounds) {
    return normalizeSquareViewportSpan(MIN_VIEWPORT_SPAN);
  }

  const furthestEdgeDistance = Math.max(
    Math.abs(center.x - paddedBounds.minX),
    Math.abs(paddedBounds.maxX - center.x),
    Math.abs(center.y - paddedBounds.minY),
    Math.abs(paddedBounds.maxY - center.y),
  );

  return normalizeSquareViewportSpan(
    Math.max(MIN_VIEWPORT_SPAN, Math.ceil(furthestEdgeDistance * 2 + 1)),
  );
}

function getRequiredViewportBaseSpan(
  universe: LifeUniverse,
  fallbackUniverse: LifeUniverse,
  viewportPadding: number,
  renderedCanvasWidth: number,
  renderedCanvasHeight: number,
) {
  const paddedBounds = getPaddedUniverseBounds(
    universe,
    fallbackUniverse,
    viewportPadding,
  );

  if (!paddedBounds) {
    return normalizeSquareViewportSpan(MIN_VIEWPORT_SPAN);
  }

  return getRequiredViewportBaseSpanForBounds(
    paddedBounds,
    renderedCanvasWidth,
    renderedCanvasHeight,
    MIN_VIEWPORT_SPAN,
  );
}

function doesBoundsFitViewport(
  bounds: UniverseBounds | null,
  viewport: Viewport,
) {
  if (!bounds) {
    return true;
  }

  return (
    bounds.minX >= viewport.minX &&
    bounds.maxX <= viewport.maxX &&
    bounds.minY >= viewport.minY &&
    bounds.maxY <= viewport.maxY
  );
}

function buildViewport(
  baseSpan: number,
  center: ViewportCenter,
  zoomFactor: number,
  renderedCanvasWidth: number,
  renderedCanvasHeight: number,
): Viewport {
  const { spanX, spanY } = getViewportSpans(
    baseSpan,
    zoomFactor,
    renderedCanvasWidth,
    renderedCanvasHeight,
  );

  return createViewport(center, spanX, spanY);
}

function getAutofitViewportCenter(
  currentViewport: Viewport,
  bounds: UniverseBounds,
  baseSpan: number,
  zoomFactor: number,
  renderedCanvasWidth: number,
  renderedCanvasHeight: number,
) {
  const { spanX, spanY } = getViewportSpans(
    baseSpan,
    zoomFactor,
    renderedCanvasWidth,
    renderedCanvasHeight,
  );

  return getViewportCenterForBounds(
    currentViewport.center,
    bounds,
    spanX,
    spanY,
  );
}

function getCanvasViewportMetrics(
  canvas: HTMLCanvasElement,
  viewportBaseSpan: number,
  center: ViewportCenter,
  zoomFactor: number,
): CanvasViewportMetrics {
  const canvasRect = canvas.getBoundingClientRect();
  const renderedCanvasWidth = Math.max(
    1,
    Math.floor(canvas.clientWidth || canvasRect.width),
  );
  const renderedCanvasHeight = Math.max(
    1,
    Math.floor(canvas.clientHeight || canvasRect.height),
  );
  const viewport = buildViewport(
    viewportBaseSpan,
    center,
    zoomFactor,
    renderedCanvasWidth,
    renderedCanvasHeight,
  );
  const displayCellSize = Math.min(
    renderedCanvasWidth / viewport.spanX,
    renderedCanvasHeight / viewport.spanY,
  );

  return {
    canvasRect,
    displayCellSize,
    renderedCanvasHeight,
    renderedCanvasWidth,
    viewport,
  };
}

function getClientPointWorldCoordinates(
  canvasMetrics: CanvasViewportMetrics,
  clientX: number,
  clientY: number,
) {
  const localX = clientX - canvasMetrics.canvasRect.left;
  const localY = clientY - canvasMetrics.canvasRect.top;
  const halfCanvasWidth = canvasMetrics.renderedCanvasWidth / 2;
  const halfCanvasHeight = canvasMetrics.renderedCanvasHeight / 2;

  return {
    worldX:
      canvasMetrics.viewport.center.x +
      (localX - halfCanvasWidth) / canvasMetrics.displayCellSize,
    worldY:
      canvasMetrics.viewport.center.y +
      (localY - halfCanvasHeight) / canvasMetrics.displayCellSize,
  };
}

function getPinchGesture(
  activePointers: Map<number, PointerCoordinates>,
): PinchGesture | null {
  const [firstPointer, secondPointer] = Array.from(activePointers.values());

  if (!firstPointer || !secondPointer) {
    return null;
  }

  const deltaX = secondPointer.clientX - firstPointer.clientX;
  const deltaY = secondPointer.clientY - firstPointer.clientY;

  return {
    centerX: (firstPointer.clientX + secondPointer.clientX) / 2,
    centerY: (firstPointer.clientY + secondPointer.clientY) / 2,
    distance: Math.hypot(deltaX, deltaY),
  };
}

function drawUniverse(
  canvas: HTMLCanvasElement,
  universe: LifeUniverse,
  gliderCells: LifeUniverse,
  debugSnapshot: LifeDebugSnapshot | null,
  viewportBaseSpan: number,
  center: ViewportCenter,
  zoomFactor: number,
) {
  const {
    displayCellSize,
    renderedCanvasHeight,
    renderedCanvasWidth,
    viewport,
  } = getCanvasViewportMetrics(canvas, viewportBaseSpan, center, zoomFactor);
  const devicePixelRatio = window.devicePixelRatio || 1;
  const canvasCenterX = renderedCanvasWidth / 2;
  const canvasCenterY = renderedCanvasHeight / 2;
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
  canvas.width = Math.round(renderedCanvasWidth * devicePixelRatio);
  canvas.height = Math.round(renderedCanvasHeight * devicePixelRatio);

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, renderedCanvasWidth, renderedCanvasHeight);
  context.fillStyle = "#030712";
  context.fillRect(0, 0, renderedCanvasWidth, renderedCanvasHeight);

  if (shouldDrawGrid) {
    context.fillStyle = "#0f172a";
    context.globalAlpha = gridInsetStrength;

    const startWorldY = Math.floor(viewport.center.y - viewport.spanY / 2);
    const endWorldY = Math.ceil(viewport.center.y + viewport.spanY / 2);
    const startWorldX = Math.floor(viewport.center.x - viewport.spanX / 2);
    const endWorldX = Math.ceil(viewport.center.x + viewport.spanX / 2);

    for (let worldY = startWorldY; worldY <= endWorldY; worldY += 1) {
      const y =
        canvasCenterY + (worldY - viewport.center.y - 0.5) * displayCellSize;

      if (y >= renderedCanvasHeight || y + displayCellSize <= 0) {
        continue;
      }

      for (let worldX = startWorldX; worldX <= endWorldX; worldX += 1) {
        const x =
          canvasCenterX + (worldX - viewport.center.x - 0.5) * displayCellSize;

        if (x >= renderedCanvasWidth || x + displayCellSize <= 0) {
          continue;
        }

        context.fillRect(
          x + effectiveGridlineInset,
          y + effectiveGridlineInset,
          Math.max(0, displayCellSize - effectiveGridlineInset * 2),
          Math.max(0, displayCellSize - effectiveGridlineInset * 2),
        );
      }
    }

    context.globalAlpha = 1;
  }

  context.fillStyle = LIVE_CELL_COLOR;

  const drawCell = (cellKey: string) => {
    const { x: worldX, y: worldY } = parseCellKey(cellKey);
    const x =
      canvasCenterX + (worldX - viewport.center.x - 0.5) * displayCellSize;
    const y =
      canvasCenterY + (worldY - viewport.center.y - 0.5) * displayCellSize;

    if (
      x >= renderedCanvasWidth ||
      x + displayCellSize <= 0 ||
      y >= renderedCanvasHeight ||
      y + displayCellSize <= 0
    ) {
      return;
    }

    context.fillRect(
      x + effectiveLiveCellInset,
      y + effectiveLiveCellInset,
      Math.max(0, displayCellSize - effectiveLiveCellInset * 2),
      Math.max(0, displayCellSize - effectiveLiveCellInset * 2),
    );
  };

  for (const cellKey of universe) {
    drawCell(cellKey);
  }

  if (gliderCells.size > 0) {
    context.fillStyle = GLIDER_CELL_COLOR;

    for (const cellKey of gliderCells) {
      drawCell(cellKey);
    }
  }

  if (!debugSnapshot) {
    return;
  }

  const drawBounds = (
    bounds: LifeDebugSnapshot["universeBounds"],
    color: string,
  ) => {
    if (!bounds) {
      return;
    }

    const x =
      canvasCenterX + (bounds.minX - viewport.center.x - 0.5) * displayCellSize;
    const y =
      canvasCenterY + (bounds.minY - viewport.center.y - 0.5) * displayCellSize;
    const width = (bounds.maxX - bounds.minX + 1) * displayCellSize;
    const height = (bounds.maxY - bounds.minY + 1) * displayCellSize;

    context.save();
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, displayCellSize * 0.14);
    context.strokeRect(x, y, width, height);
    context.restore();
  };

  drawBounds(debugSnapshot.universeBounds, DEBUG_UNIVERSE_BOUNDS_COLOR);
  drawBounds(debugSnapshot.autofitBounds, DEBUG_AUTOFIT_BOUNDS_COLOR);

  context.save();
  context.strokeStyle = DEBUG_AUTOFIT_EDGE_COLOR;
  context.lineWidth = Math.max(1, displayCellSize * 0.14);

  for (const cellKey of debugSnapshot.autofitEdgeCells) {
    const { x: worldX, y: worldY } = parseCellKey(cellKey);
    const x =
      canvasCenterX + (worldX - viewport.center.x - 0.5) * displayCellSize;
    const y =
      canvasCenterY + (worldY - viewport.center.y - 0.5) * displayCellSize;

    if (
      x >= renderedCanvasWidth ||
      x + displayCellSize <= 0 ||
      y >= renderedCanvasHeight ||
      y + displayCellSize <= 0
    ) {
      continue;
    }

    context.strokeRect(
      x + effectiveLiveCellInset / 2,
      y + effectiveLiveCellInset / 2,
      Math.max(0, displayCellSize - effectiveLiveCellInset),
      Math.max(0, displayCellSize - effectiveLiveCellInset),
    );
  }

  context.restore();
}

function GameOfLifeSession({
  debug = false,
  onReset,
  onScanAnother,
  qrValue,
  seed,
}: SessionProps) {
  const initialGameViewState = createInitialGameViewState(seed);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const shareFeedbackTimerRef = useRef<number | null>(null);
  const resizeDebounceTimerRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const initialGameViewStateRef = useRef(initialGameViewState);
  const largestViewportBaseSpanRef = useRef(
    initialGameViewState.viewportBaseSpan,
  );
  const viewportCenterRef = useRef<ViewportCenter>(
    initialGameViewState.viewportCenter,
  );
  const universeRef = useRef<LifeUniverse>(
    cloneUniverse(initialGameViewState.universe),
  );
  const gliderCellsRef = useRef<LifeUniverse>(
    cloneUniverse(initialGameViewState.gliderCells),
  );
  const activePointersRef = useRef<Map<number, PointerCoordinates>>(new Map());
  const pinchGestureRef = useRef<PinchGesture | null>(null);

  const [universe, setUniverse] = useState<LifeUniverse>(() =>
    cloneUniverse(initialGameViewState.universe),
  );
  const [gliderCells, setGliderCells] = useState<LifeUniverse>(() =>
    cloneUniverse(initialGameViewState.gliderCells),
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
  const [zoomFactor, setZoomFactor] = useState(AUTO_FIT_ZOOM_FACTOR);
  const isAutoZoomEnabledRef = useRef(isAutoZoomEnabled);
  const zoomFactorRef = useRef(zoomFactor);

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

  const redrawUniverse = useCallback(
    (options?: RedrawOptions) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const nextUniverse = options?.universe ?? universeRef.current;
      const nextGliderCells = options?.gliderCells ?? gliderCellsRef.current;
      const nextAutofitUniverse = getAutofitUniverse(
        nextUniverse,
        nextGliderCells,
      );
      const nextIsAutoZoomEnabled =
        options?.isAutoZoomEnabled ?? isAutoZoomEnabledRef.current;
      const nextZoomFactor = options?.zoomFactor ?? zoomFactorRef.current;
      let nextViewportCenter =
        options?.viewportCenter ?? viewportCenterRef.current;
      let nextViewportBaseSpan = largestViewportBaseSpanRef.current;
      const renderedCanvasWidth = Math.max(
        1,
        Math.floor(canvas.clientWidth || canvas.getBoundingClientRect().width),
      );
      const renderedCanvasHeight = Math.max(
        1,
        Math.floor(
          canvas.clientHeight || canvas.getBoundingClientRect().height,
        ),
      );
      const nextAutofitBounds = getPaddedUniverseBounds(
        nextAutofitUniverse,
        nextAutofitUniverse,
        AUTO_FIT_VIEWPORT_PADDING,
      );
      const nextAutofitTargetSpan = nextAutofitBounds
        ? getRequiredViewportBaseSpan(
            nextAutofitUniverse,
            nextAutofitUniverse,
            AUTO_FIT_VIEWPORT_PADDING,
            renderedCanvasWidth,
            renderedCanvasHeight,
          )
        : null;

      if (nextIsAutoZoomEnabled && nextAutofitBounds) {
        const currentViewport = buildViewport(
          nextViewportBaseSpan,
          nextViewportCenter,
          nextZoomFactor,
          renderedCanvasWidth,
          renderedCanvasHeight,
        );

        if (!doesBoundsFitViewport(nextAutofitBounds, currentViewport)) {
          if (
            nextAutofitTargetSpan !== null &&
            nextAutofitTargetSpan > nextViewportBaseSpan
          ) {
            nextViewportBaseSpan = Math.min(
              nextAutofitTargetSpan,
              nextViewportBaseSpan + 1,
            );
          }

          nextViewportCenter = getAutofitViewportCenter(
            currentViewport,
            nextAutofitBounds,
            nextViewportBaseSpan,
            nextZoomFactor,
            renderedCanvasWidth,
            renderedCanvasHeight,
          );

          largestViewportBaseSpanRef.current = nextViewportBaseSpan;
          viewportCenterRef.current = nextViewportCenter;
        }
      }
      const nextDebugSnapshot = debug
        ? createLifeDebugSnapshot({
            autofitTargetSpan: nextAutofitTargetSpan,
            gliderCells: nextGliderCells,
            universe: nextUniverse,
            viewportBaseSpan: nextViewportBaseSpan,
          })
        : null;

      drawUniverse(
        canvas,
        nextUniverse,
        nextGliderCells,
        nextDebugSnapshot,
        nextViewportBaseSpan,
        nextViewportCenter,
        nextZoomFactor,
      );
    },
    [debug],
  );

  const disableAutoZoom = useCallback(() => {
    if (!isAutoZoomEnabledRef.current) {
      return;
    }

    isAutoZoomEnabledRef.current = false;
    setIsAutoZoomEnabled(false);
  }, []);

  const commitManualViewport = useCallback(
    (
      nextViewportCenter: ViewportCenter,
      nextZoomFactor = zoomFactorRef.current,
    ) => {
      viewportCenterRef.current = nextViewportCenter;
      disableAutoZoom();

      if (zoomFactorRef.current !== nextZoomFactor) {
        zoomFactorRef.current = nextZoomFactor;
        setZoomFactor(nextZoomFactor);
      }

      redrawUniverse({
        isAutoZoomEnabled: false,
        viewportCenter: nextViewportCenter,
        zoomFactor: nextZoomFactor,
      });
    },
    [disableAutoZoom, redrawUniverse],
  );

  const panViewportByPixels = useCallback(
    (deltaX: number, deltaY: number) => {
      const canvas = canvasRef.current;

      if (!canvas || (deltaX === 0 && deltaY === 0)) {
        return;
      }

      const { displayCellSize } = getCanvasViewportMetrics(
        canvas,
        largestViewportBaseSpanRef.current,
        viewportCenterRef.current,
        zoomFactorRef.current,
      );

      const nextViewportCenter = {
        x: viewportCenterRef.current.x - deltaX / displayCellSize,
        y: viewportCenterRef.current.y - deltaY / displayCellSize,
      };

      commitManualViewport(nextViewportCenter);
    },
    [commitManualViewport],
  );

  const zoomViewportAtClientPoint = useCallback(
    (clientX: number, clientY: number, zoomMultiplier: number) => {
      const canvas = canvasRef.current;

      if (!canvas || !Number.isFinite(zoomMultiplier) || zoomMultiplier <= 0) {
        return;
      }

      const currentCanvasMetrics = getCanvasViewportMetrics(
        canvas,
        largestViewportBaseSpanRef.current,
        viewportCenterRef.current,
        zoomFactorRef.current,
      );
      const { worldX, worldY } = getClientPointWorldCoordinates(
        currentCanvasMetrics,
        clientX,
        clientY,
      );
      const nextZoomFactor = clampZoomFactor(
        zoomFactorRef.current * zoomMultiplier,
      );

      if (nextZoomFactor === zoomFactorRef.current) {
        return;
      }

      const nextViewport = buildViewport(
        largestViewportBaseSpanRef.current,
        viewportCenterRef.current,
        nextZoomFactor,
        currentCanvasMetrics.renderedCanvasWidth,
        currentCanvasMetrics.renderedCanvasHeight,
      );
      const nextDisplayCellSize = Math.min(
        currentCanvasMetrics.renderedCanvasWidth / nextViewport.spanX,
        currentCanvasMetrics.renderedCanvasHeight / nextViewport.spanY,
      );
      const localX = clientX - currentCanvasMetrics.canvasRect.left;
      const localY = clientY - currentCanvasMetrics.canvasRect.top;
      const nextViewportCenter = {
        x:
          worldX -
          (localX - currentCanvasMetrics.renderedCanvasWidth / 2) /
            nextDisplayCellSize,
        y:
          worldY -
          (localY - currentCanvasMetrics.renderedCanvasHeight / 2) /
            nextDisplayCellSize,
      };

      commitManualViewport(nextViewportCenter, nextZoomFactor);
    },
    [commitManualViewport],
  );

  const restoreInitialGameView = useCallback(
    (nextInitialGameViewState = initialGameViewStateRef.current) => {
      const nextUniverse = cloneUniverse(nextInitialGameViewState.universe);

      activePointersRef.current.clear();
      pinchGestureRef.current = null;
      largestViewportBaseSpanRef.current =
        nextInitialGameViewState.viewportBaseSpan;
      viewportCenterRef.current = nextInitialGameViewState.viewportCenter;
      universeRef.current = nextUniverse;
      gliderCellsRef.current = cloneUniverse(
        nextInitialGameViewState.gliderCells,
      );
      setUniverse(nextUniverse);
      setGliderCells(cloneUniverse(nextInitialGameViewState.gliderCells));
      setIsAutoZoomEnabled(true);
      isAutoZoomEnabledRef.current = true;
      setZoomFactor(AUTO_FIT_ZOOM_FACTOR);
      zoomFactorRef.current = AUTO_FIT_ZOOM_FACTOR;
      setGeneration(0);
      setHasStartedOnce(false);
      setPopulation(nextInitialGameViewState.population);

      redrawUniverse({
        isAutoZoomEnabled: true,
        universe: nextUniverse,
        viewportCenter: nextInitialGameViewState.viewportCenter,
        zoomFactor: AUTO_FIT_ZOOM_FACTOR,
      });
    },
    [redrawUniverse],
  );

  const advanceLife = useCallback(() => {
    const nextUniverse = nextGeneration(universeRef.current);
    const nextGliderCells = getFreeFlyingGliderCells(nextUniverse);
    const nextPopulation = countPopulation(nextUniverse);

    universeRef.current = nextUniverse;
    gliderCellsRef.current = nextGliderCells;
    setUniverse(nextUniverse);
    setGliderCells(nextGliderCells);
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
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();

    zoomViewportAtClientPoint(
      canvasRect.left + canvasRect.width / 2,
      canvasRect.top + canvasRect.height / 2,
      ZOOM_STEP,
    );
  }, [zoomViewportAtClientPoint]);

  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();

    zoomViewportAtClientPoint(
      canvasRect.left + canvasRect.width / 2,
      canvasRect.top + canvasRect.height / 2,
      1 / ZOOM_STEP,
    );
  }, [zoomViewportAtClientPoint]);

  const handleFit = useCallback(() => {
    const canvas = canvasRef.current;
    const nextAutofitUniverse = getAutofitUniverse(
      universeRef.current,
      gliderCellsRef.current,
    );
    let nextViewportCenter = initialGameViewStateRef.current.viewportCenter;
    let nextViewportBaseSpan = initialGameViewStateRef.current.viewportBaseSpan;

    if (canvas) {
      const renderedCanvasWidth = Math.max(
        1,
        Math.floor(canvas.clientWidth || canvas.getBoundingClientRect().width),
      );
      const renderedCanvasHeight = Math.max(
        1,
        Math.floor(
          canvas.clientHeight || canvas.getBoundingClientRect().height,
        ),
      );
      const currentViewport = buildViewport(
        largestViewportBaseSpanRef.current,
        viewportCenterRef.current,
        zoomFactorRef.current,
        renderedCanvasWidth,
        renderedCanvasHeight,
      );
      const nextAutofitBounds = getPaddedUniverseBounds(
        nextAutofitUniverse,
        nextAutofitUniverse,
        AUTO_FIT_VIEWPORT_PADDING,
      );

      if (nextAutofitBounds) {
        nextViewportBaseSpan = getRequiredViewportBaseSpan(
          nextAutofitUniverse,
          nextAutofitUniverse,
          AUTO_FIT_VIEWPORT_PADDING,
          renderedCanvasWidth,
          renderedCanvasHeight,
        );
        nextViewportCenter = getAutofitViewportCenter(
          currentViewport,
          nextAutofitBounds,
          nextViewportBaseSpan,
          AUTO_FIT_ZOOM_FACTOR,
          renderedCanvasWidth,
          renderedCanvasHeight,
        );
      }
    }

    activePointersRef.current.clear();
    pinchGestureRef.current = null;
    viewportCenterRef.current = nextViewportCenter;
    largestViewportBaseSpanRef.current = nextViewportBaseSpan;
    setZoomFactor(AUTO_FIT_ZOOM_FACTOR);
    setIsAutoZoomEnabled(true);
    zoomFactorRef.current = AUTO_FIT_ZOOM_FACTOR;
    isAutoZoomEnabledRef.current = true;

    redrawUniverse({
      isAutoZoomEnabled: true,
      viewportCenter: nextViewportCenter,
      zoomFactor: AUTO_FIT_ZOOM_FACTOR,
    });
  }, [redrawUniverse]);

  const handleCanvasWheel = useCallback(
    (event: ReactWheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();

      const zoomMultiplier = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);

      zoomViewportAtClientPoint(event.clientX, event.clientY, zoomMultiplier);
    },
    [zoomViewportAtClientPoint],
  );

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      activePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      pinchGestureRef.current = getPinchGesture(activePointersRef.current);
    },
    [],
  );

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const previousPointer = activePointersRef.current.get(event.pointerId);

      if (!previousPointer) {
        return;
      }

      activePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });

      if (activePointersRef.current.size >= 2) {
        const nextPinchGesture = getPinchGesture(activePointersRef.current);

        if (!nextPinchGesture) {
          pinchGestureRef.current = null;
          return;
        }

        const previousPinchGesture = pinchGestureRef.current;
        pinchGestureRef.current = nextPinchGesture;

        if (!previousPinchGesture) {
          return;
        }

        const deltaX = nextPinchGesture.centerX - previousPinchGesture.centerX;
        const deltaY = nextPinchGesture.centerY - previousPinchGesture.centerY;

        if (deltaX !== 0 || deltaY !== 0) {
          panViewportByPixels(deltaX, deltaY);
        }

        if (
          previousPinchGesture.distance > 0 &&
          nextPinchGesture.distance > 0 &&
          nextPinchGesture.distance !== previousPinchGesture.distance
        ) {
          zoomViewportAtClientPoint(
            nextPinchGesture.centerX,
            nextPinchGesture.centerY,
            nextPinchGesture.distance / previousPinchGesture.distance,
          );
        }

        return;
      }

      pinchGestureRef.current = null;
      panViewportByPixels(
        event.clientX - previousPointer.clientX,
        event.clientY - previousPointer.clientY,
      );
    },
    [panViewportByPixels, zoomViewportAtClientPoint],
  );

  const handleCanvasPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      activePointersRef.current.delete(event.pointerId);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      pinchGestureRef.current = getPinchGesture(activePointersRef.current);
    },
    [],
  );

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
    isAutoZoomEnabledRef.current = isAutoZoomEnabled;
  }, [isAutoZoomEnabled]);

  useEffect(() => {
    zoomFactorRef.current = zoomFactor;
  }, [zoomFactor]);

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
    redrawUniverse({
      gliderCells,
      isAutoZoomEnabled,
      universe,
      zoomFactor,
    });
  }, [gliderCells, isAutoZoomEnabled, redrawUniverse, universe, zoomFactor]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || typeof ResizeObserver === "undefined") {
      return;
    }

    const scheduleRedraw = () => {
      if (resizeDebounceTimerRef.current !== null) {
        window.clearTimeout(resizeDebounceTimerRef.current);
      }

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }

      resizeDebounceTimerRef.current = window.setTimeout(() => {
        resizeDebounceTimerRef.current = null;
        resizeFrameRef.current = window.requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          redrawUniverse();
        });
      }, RESIZE_REDRAW_DEBOUNCE_MS);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleRedraw();
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();

      if (resizeDebounceTimerRef.current !== null) {
        window.clearTimeout(resizeDebounceTimerRef.current);
        resizeDebounceTimerRef.current = null;
      }

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [redrawUniverse]);

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
      activePointersRef.current.clear();
      pinchGestureRef.current = null;
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
  const currentGliderCells = gliderCells;
  const currentAutofitUniverse = getAutofitUniverse(
    universe,
    currentGliderCells,
  );
  const debugCanvas = canvasRef.current;
  const currentAutofitTargetSpan =
    debugCanvas && currentAutofitUniverse.size > 0
      ? getRequiredViewportBaseSpan(
          currentAutofitUniverse,
          currentAutofitUniverse,
          AUTO_FIT_VIEWPORT_PADDING,
          Math.max(
            1,
            Math.floor(
              debugCanvas.clientWidth ||
                debugCanvas.getBoundingClientRect().width,
            ),
          ),
          Math.max(
            1,
            Math.floor(
              debugCanvas.clientHeight ||
                debugCanvas.getBoundingClientRect().height,
            ),
          ),
        )
      : null;
  const currentDebugSnapshot = debug
    ? createLifeDebugSnapshot({
        autofitTargetSpan: currentAutofitTargetSpan,
        gliderCells: currentGliderCells,
        universe,
        viewportBaseSpan: largestViewportBaseSpanRef.current,
      })
    : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-[#020617]">
        <div className="flex min-h-0 flex-1 flex-col gap-3 pb-3 sm:gap-4 sm:pb-4">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden border-b border-cyan-300/14 bg-[#020617] p-1">
            <div className="relative h-full w-full">
              <canvas
                ref={canvasRef}
                onPointerCancel={handleCanvasPointerUp}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onWheel={handleCanvasWheel}
                className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
              />

              <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4 lg:justify-end">
                {debug && currentDebugSnapshot && (
                  <GameOfLifeDebugPanel debugSnapshot={currentDebugSnapshot} />
                )}

                <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/12 bg-slate-950 px-2.5 pt-2 pb-1 sm:flex-row sm:items-baseline sm:gap-2 sm:rounded-full sm:px-3 sm:py-1">
                  <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
                    Gen
                  </span>
                  <span className="font-mono text-sm text-white sm:text-base lg:text-lg">
                    {generation}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/12 bg-slate-950 px-2.5 pt-2 pb-1 sm:flex-row sm:items-baseline sm:gap-2 sm:rounded-full sm:px-3 sm:py-1">
                  <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
                    Cells
                  </span>
                  <span className="font-mono text-sm text-cyan-200 sm:text-base lg:text-lg">
                    {population}
                  </span>
                </div>
              </div>

              <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2 sm:inset-x-4 sm:bottom-4 lg:justify-end">
                <div className="rounded-xl border border-white/12 bg-slate-950 p-1.5 pb-3 sm:rounded-full sm:py-2 sm:pl-3 sm:pr-2.5 lg:py-3 lg:pr-3">
                  <label className="flex flex-col items-center gap-2 sm:flex-row">
                    <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
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

                <div className="flex flex-col items-center gap-1 rounded-xl border border-white/12 bg-slate-950 p-1.5 sm:flex-row sm:gap-2 sm:rounded-full sm:py-1 sm:pl-3 sm:pr-1.5 lg:py-1.5 lg:pr-2">
                  <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-slate-200/80 sm:text-xs lg:text-sm">
                    Zoom
                  </span>
                  <div className="inline-flex items-center gap-1">
                    <Button
                      type="button"
                      onClick={handleZoomOut}
                      variant="quiet"
                      className="size-6 rounded-full bg-slate-900/82 text-xl leading-none font-semibold hover:bg-slate-800/88 lg:size-8 lg:text-2xl"
                    >
                      -
                    </Button>
                    <Button
                      type="button"
                      onClick={handleZoomIn}
                      variant="quiet"
                      className="size-6 rounded-full bg-slate-900/82 text-xl leading-none font-semibold hover:bg-slate-800/88 lg:size-8 lg:text-2xl"
                    >
                      +
                    </Button>
                    <Button
                      type="button"
                      onClick={handleFit}
                      variant="quiet"
                      aria-pressed={isAutoZoomEnabled}
                      className="size-6 rounded-full bg-slate-900/82 text-[0.5rem] leading-none font-semibold uppercase tracking-[0.08em] text-slate-200/80 hover:bg-slate-800/88 lg:size-8 lg:text-xs"
                    >
                      Fit
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-3 sm:px-4">
            <div className="flex flex-wrap gap-3 lg:justify-center">
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

              <div className="relative min-w-40 max-w-80 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 lg:w-80 lg:flex-none">
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
    </div>
  );
}

export function GameOfLife({
  debug = false,
  onScanAnother,
  qrValue,
  seed,
}: Props) {
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <GameOfLifeSession
      debug={debug}
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
