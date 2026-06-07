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
const INITIAL_VIEWPORT_PADDING = 6;
const AUTO_FIT_VIEWPORT_PADDING = 5;
// Keep a little extra breathing room around the initial view so the
// scanned QR doesn't start edge-to-edge in the viewport.
const INITIAL_FIT_ZOOM_FACTOR = 0.9;
const AUTO_FIT_ZOOM_FACTOR = 1;
const LARGE_SCREEN_MEDIA_QUERY = "(min-width: 64rem)";
const DEFAULT_TICK_DELAY_MS = 200;
const ZOOM_STEP = 1.25;
const MIN_TICK_DELAY_MS = 0;
const MAX_TICK_DELAY_MS = 400;
const TICK_DELAY_STORAGE_KEY = "qr-life:game-of-life:tick-delay-ms";
const RESIZE_REDRAW_DEBOUNCE_MS = 80;

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
  spanX: number;
  spanY: number;
};

type ViewportCenter = {
  x: number;
  y: number;
};

type RedrawOptions = {
  isAutoZoomEnabled?: boolean;
  universe?: LifeUniverse;
  zoomFactor?: number;
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

function getInitialFitZoomFactor() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia(LARGE_SCREEN_MEDIA_QUERY).matches
  ) {
    return INITIAL_FIT_ZOOM_FACTOR / ZOOM_STEP;
  }

  return INITIAL_FIT_ZOOM_FACTOR;
}

function getInitialViewportBaseSpan(
  viewportBaseSpan: number,
  center: ViewportCenter,
) {
  return normalizeSquareViewportSpan(
    viewportBaseSpan / getInitialFitZoomFactor(),
    center,
  );
}

function createInitialGameViewState(seed: LifeGrid): InitialGameViewState {
  const universe = createUniverseFromSeed(seed);
  const viewportCenter = getSeedViewportCenter(seed);
  const viewportBaseSpan = getViewportBaseSpan(
    universe,
    universe,
    viewportCenter,
    INITIAL_VIEWPORT_PADDING,
  );

  return {
    population: countPopulation(universe),
    universe,
    viewportBaseSpan: getInitialViewportBaseSpan(
      viewportBaseSpan,
      viewportCenter,
    ),
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
    minX: Math.floor(center.x - halfSpanX),
    minY: Math.floor(center.y - halfSpanY),
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

function normalizeViewportSpanForAxis(
  span: number,
  centerCoordinate: number,
): number {
  let nextSpan = Math.max(1, Math.ceil(span));
  const shouldUseOddSpan = Number.isInteger(centerCoordinate);

  if ((nextSpan % 2 === 1) !== shouldUseOddSpan) {
    nextSpan += 1;
  }

  return nextSpan;
}

function normalizeSquareViewportSpan(
  span: number,
  center: ViewportCenter,
): number {
  return Math.max(
    normalizeViewportSpanForAxis(span, center.x),
    normalizeViewportSpanForAxis(span, center.y),
  );
}

function getPaddedUniverseBounds(
  universe: LifeUniverse,
  fallbackUniverse: LifeUniverse,
  viewportPadding: number,
) {
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
    return normalizeSquareViewportSpan(MIN_VIEWPORT_SPAN, center);
  }

  const furthestEdgeDistance = Math.max(
    Math.abs(center.x - paddedBounds.minX),
    Math.abs(paddedBounds.maxX - center.x),
    Math.abs(center.y - paddedBounds.minY),
    Math.abs(paddedBounds.maxY - center.y),
  );

  return normalizeSquareViewportSpan(
    Math.max(MIN_VIEWPORT_SPAN, Math.ceil(furthestEdgeDistance * 2 + 1)),
    center,
  );
}

function getRequiredViewportBaseSpan(
  universe: LifeUniverse,
  fallbackUniverse: LifeUniverse,
  center: ViewportCenter,
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
    return normalizeSquareViewportSpan(MIN_VIEWPORT_SPAN, center);
  }

  const requiredSpanX = normalizeViewportSpanForAxis(
    Math.max(
      MIN_VIEWPORT_SPAN,
      Math.ceil(
        Math.max(
          Math.abs(center.x - paddedBounds.minX),
          Math.abs(paddedBounds.maxX - center.x),
        ) *
          2 +
          1,
      ),
    ),
    center.x,
  );
  const requiredSpanY = normalizeViewportSpanForAxis(
    Math.max(
      MIN_VIEWPORT_SPAN,
      Math.ceil(
        Math.max(
          Math.abs(center.y - paddedBounds.minY),
          Math.abs(paddedBounds.maxY - center.y),
        ) *
          2 +
          1,
      ),
    ),
    center.y,
  );

  if (renderedCanvasWidth >= renderedCanvasHeight) {
    return normalizeViewportSpanForAxis(
      Math.max(
        requiredSpanY,
        (requiredSpanX * renderedCanvasHeight) / renderedCanvasWidth,
      ),
      center.y,
    );
  }

  return normalizeViewportSpanForAxis(
    Math.max(
      requiredSpanX,
      (requiredSpanY * renderedCanvasWidth) / renderedCanvasHeight,
    ),
    center.x,
  );
}

function doesUniverseFitViewport(
  universe: LifeUniverse,
  fallbackUniverse: LifeUniverse,
  viewport: Viewport,
  viewportPadding: number,
) {
  const paddedBounds = getPaddedUniverseBounds(
    universe,
    fallbackUniverse,
    viewportPadding,
  );

  if (!paddedBounds) {
    return true;
  }

  const viewportMaxX = viewport.minX + viewport.spanX - 1;
  const viewportMaxY = viewport.minY + viewport.spanY - 1;

  return (
    paddedBounds.minX >= viewport.minX &&
    paddedBounds.maxX <= viewportMaxX &&
    paddedBounds.minY >= viewport.minY &&
    paddedBounds.maxY <= viewportMaxY
  );
}

function buildViewport(
  baseSpan: number,
  center: ViewportCenter,
  zoomFactor: number,
  renderedCanvasWidth: number,
  renderedCanvasHeight: number,
): Viewport {
  const nextBaseSpan = Math.max(1, baseSpan / zoomFactor);

  if (renderedCanvasWidth >= renderedCanvasHeight) {
    const spanY = normalizeViewportSpanForAxis(nextBaseSpan, center.y);
    const spanX = normalizeViewportSpanForAxis(
      (spanY * renderedCanvasWidth) / renderedCanvasHeight,
      center.x,
    );

    return createViewport(center, spanX, spanY);
  }

  const spanX = normalizeViewportSpanForAxis(nextBaseSpan, center.x);
  const spanY = normalizeViewportSpanForAxis(
    (spanX * renderedCanvasHeight) / renderedCanvasWidth,
    center.y,
  );

  return createViewport(center, spanX, spanY);
}

function drawUniverse(
  canvas: HTMLCanvasElement,
  universe: LifeUniverse,
  viewportBaseSpan: number,
  center: ViewportCenter,
  zoomFactor: number,
) {
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
  const devicePixelRatio = window.devicePixelRatio || 1;
  const displayCellSize = Math.min(
    renderedCanvasWidth / viewport.spanX,
    renderedCanvasHeight / viewport.spanY,
  );
  const renderedGridWidth = displayCellSize * viewport.spanX;
  const renderedGridHeight = displayCellSize * viewport.spanY;
  const gridOffsetX = (renderedCanvasWidth - renderedGridWidth) / 2;
  const gridOffsetY = (renderedCanvasHeight - renderedGridHeight) / 2;
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

  if (!shouldDrawGrid) {
    const rasterCanvas = document.createElement("canvas");
    rasterCanvas.width = viewport.spanX;
    rasterCanvas.height = viewport.spanY;

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
        columnIndex >= viewport.spanX ||
        rowIndex < 0 ||
        rowIndex >= viewport.spanY
      ) {
        continue;
      }

      rasterContext.fillRect(columnIndex, rowIndex, 1, 1);
    }

    context.drawImage(
      rasterCanvas,
      gridOffsetX,
      gridOffsetY,
      renderedGridWidth,
      renderedGridHeight,
    );
    return;
  }

  if (shouldDrawGrid) {
    context.fillStyle = "#0f172a";
    context.globalAlpha = gridInsetStrength;

    for (let rowIndex = 0; rowIndex < viewport.spanY; rowIndex += 1) {
      for (
        let columnIndex = 0;
        columnIndex < viewport.spanX;
        columnIndex += 1
      ) {
        const x = gridOffsetX + columnIndex * displayCellSize;
        const y = gridOffsetY + rowIndex * displayCellSize;

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

  for (const cellKey of universe) {
    const { x: worldX, y: worldY } = parseCellKey(cellKey);
    const columnIndex = worldX - viewport.minX;
    const rowIndex = worldY - viewport.minY;

    if (
      columnIndex < 0 ||
      columnIndex >= viewport.spanX ||
      rowIndex < 0 ||
      rowIndex >= viewport.spanY
    ) {
      continue;
    }

    const x = gridOffsetX + columnIndex * displayCellSize;
    const y = gridOffsetY + rowIndex * displayCellSize;

    context.fillRect(
      x + effectiveLiveCellInset,
      y + effectiveLiveCellInset,
      Math.max(0, displayCellSize - effectiveLiveCellInset * 2),
      Math.max(0, displayCellSize - effectiveLiveCellInset * 2),
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
  const resizeDebounceTimerRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
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

  const redrawUniverse = useCallback((options?: RedrawOptions) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const nextUniverse = options?.universe ?? universeRef.current;
    const nextIsAutoZoomEnabled =
      options?.isAutoZoomEnabled ?? isAutoZoomEnabledRef.current;
    const nextZoomFactor = options?.zoomFactor ?? zoomFactorRef.current;
    const nextSeedViewportCenter =
      initialGameViewStateRef.current.viewportCenter;
    const renderedCanvasWidth = Math.max(
      1,
      Math.floor(canvas.clientWidth || canvas.getBoundingClientRect().width),
    );
    const renderedCanvasHeight = Math.max(
      1,
      Math.floor(canvas.clientHeight || canvas.getBoundingClientRect().height),
    );

    if (nextIsAutoZoomEnabled) {
      const currentViewport = buildViewport(
        largestViewportBaseSpanRef.current,
        nextSeedViewportCenter,
        nextZoomFactor,
        renderedCanvasWidth,
        renderedCanvasHeight,
      );

      if (
        !doesUniverseFitViewport(
          nextUniverse,
          initialUniverseRef.current,
          currentViewport,
          AUTO_FIT_VIEWPORT_PADDING,
        )
      ) {
        const requiredBaseSpan = getRequiredViewportBaseSpan(
          nextUniverse,
          initialUniverseRef.current,
          nextSeedViewportCenter,
          AUTO_FIT_VIEWPORT_PADDING,
          renderedCanvasWidth,
          renderedCanvasHeight,
        );

        if (requiredBaseSpan > largestViewportBaseSpanRef.current) {
          largestViewportBaseSpanRef.current = Math.min(
            requiredBaseSpan,
            largestViewportBaseSpanRef.current + 1,
          );
        }
      }
    }

    drawUniverse(
      canvas,
      nextUniverse,
      largestViewportBaseSpanRef.current,
      nextSeedViewportCenter,
      nextZoomFactor,
    );
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
      isAutoZoomEnabledRef.current = true;
      setZoomFactor(AUTO_FIT_ZOOM_FACTOR);
      zoomFactorRef.current = AUTO_FIT_ZOOM_FACTOR;
      setGeneration(0);
      setHasStartedOnce(false);
      setPopulation(nextInitialGameViewState.population);

      redrawUniverse({
        isAutoZoomEnabled: true,
        universe: nextUniverse,
        zoomFactor: AUTO_FIT_ZOOM_FACTOR,
      });
    },
    [redrawUniverse],
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
    isAutoZoomEnabledRef.current = false;
    setZoomFactor((current) => {
      const nextZoomFactor = current * ZOOM_STEP;
      zoomFactorRef.current = nextZoomFactor;
      return nextZoomFactor;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setIsAutoZoomEnabled(false);
    isAutoZoomEnabledRef.current = false;
    setZoomFactor((current) => {
      const nextZoomFactor = current / ZOOM_STEP;
      zoomFactorRef.current = nextZoomFactor;
      return nextZoomFactor;
    });
  }, []);

  const handleFit = useCallback(() => {
    setZoomFactor(AUTO_FIT_ZOOM_FACTOR);
    setIsAutoZoomEnabled(true);
    zoomFactorRef.current = AUTO_FIT_ZOOM_FACTOR;
    isAutoZoomEnabledRef.current = true;
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
      isAutoZoomEnabled,
      universe,
      zoomFactor,
    });
  }, [isAutoZoomEnabled, redrawUniverse, universe, zoomFactor]);

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
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-[#020617]">
        <div className="flex min-h-0 flex-1 flex-col gap-3 pb-3 sm:gap-4 sm:pb-4">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden border-b border-cyan-300/14 bg-[#020617] p-1">
            <div className="relative h-full w-full">
              <canvas ref={canvasRef} className="h-full w-full" />

              <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4 lg:justify-end">
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
                      className="h-1.5 w-20 cursor-pointer accent-cyan-300 sm:w-28"
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
