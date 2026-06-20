import {
  cloneUniverse,
  countPopulation,
  createUniverseFromSeed,
  type FreeFlyingPatternCells,
  getAutofitUniverse,
  getFreeFlyingPatternCells,
  getUniverseBounds,
  type LifeGrid,
  type LifeUniverse,
  type UniverseBounds,
} from "@/lib/game-of-life";
import type { LifeDebugSnapshot } from "@/lib/game-of-life-debug";
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
const GLIDER_CELL_COLOR = "#ffcc4a";
const LWSS_CELL_COLOR = "#46ea82";
const MWSS_CELL_COLOR = "#ff0228";
const DEBUG_AUTOFIT_BOUNDS_COLOR = "#f43f5e";
const DEBUG_UNIVERSE_BOUNDS_COLOR = "#22c55e";
const DEBUG_AUTOFIT_EDGE_COLOR = "#f8fafc";

export const MIN_VIEWPORT_SPAN = 41;
export const INITIAL_VIEWPORT_PADDING = 6;
export const AUTO_FIT_VIEWPORT_PADDING = 5;

// Keep a little extra breathing room around the initial view so the
// scanned QR doesn't start edge-to-edge in the viewport.
const INITIAL_FIT_ZOOM_FACTOR = 0.9;
export const AUTO_FIT_ZOOM_FACTOR = 1;
const LARGE_SCREEN_MEDIA_QUERY = "(min-width: 64rem)";

export const DEFAULT_TICK_DELAY_MS = 200;
export const ZOOM_STEP = 1.25;
const MIN_ZOOM_FACTOR = 0.125;
const MAX_ZOOM_FACTOR = 64;
export const WHEEL_ZOOM_SENSITIVITY = 0.0015;
export const MIN_TICK_DELAY_MS = 0;
export const MAX_TICK_DELAY_MS = 400;
export const TICK_DELAY_STORAGE_KEY = "qr-life:game-of-life:tick-delay-ms";
export const RESIZE_REDRAW_DEBOUNCE_MS = 80;

export type Viewport = {
  center: ViewportCenter;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  spanX: number;
  spanY: number;
};

export type ViewportCenter = {
  x: number;
  y: number;
};

export type InitialGameViewState = {
  patternCells: FreeFlyingPatternCells;
  population: number;
  universe: LifeUniverse;
  viewportBaseSpan: number;
  viewportCenter: ViewportCenter;
};

export type CanvasViewportMetrics = {
  canvasRect: DOMRect;
  displayCellSize: number;
  renderedCanvasHeight: number;
  renderedCanvasWidth: number;
  viewport: Viewport;
};

export type PointerCoordinates = {
  clientX: number;
  clientY: number;
};

export type PinchGesture = {
  centerX: number;
  centerY: number;
  distance: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampTickDelayMs(value: number) {
  return Math.min(MAX_TICK_DELAY_MS, Math.max(MIN_TICK_DELAY_MS, value));
}

export function clampZoomFactor(value: number) {
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

export function cloneFreeFlyingPatternCells(
  patternCells: FreeFlyingPatternCells,
): FreeFlyingPatternCells {
  return {
    excludedCells: cloneUniverse(patternCells.excludedCells),
    gliderCells: cloneUniverse(patternCells.gliderCells),
    lwssCells: cloneUniverse(patternCells.lwssCells),
    mwssCells: cloneUniverse(patternCells.mwssCells),
  };
}

export function createInitialGameViewState(
  seed: LifeGrid,
): InitialGameViewState {
  const universe = createUniverseFromSeed(seed);
  const patternCells = getFreeFlyingPatternCells(universe);
  const autofitUniverse = getAutofitUniverse(
    universe,
    patternCells.excludedCells,
  );
  const viewportCenter = getSeedViewportCenter(seed);
  const viewportBaseSpan = getViewportBaseSpan(
    autofitUniverse.size > 0 ? autofitUniverse : universe,
    universe,
    viewportCenter,
    INITIAL_VIEWPORT_PADDING,
  );

  return {
    patternCells,
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

export function getPaddedUniverseBounds(
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

export function getRequiredViewportBaseSpan(
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

export function doesBoundsFitViewport(
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

export function buildViewport(
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

export function getAutofitViewportCenter(
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

export function getCanvasViewportMetrics(
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

export function getClientPointWorldCoordinates(
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

export function getPinchGesture(
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

export function drawUniverse(
  canvas: HTMLCanvasElement,
  universe: LifeUniverse,
  patternCells: FreeFlyingPatternCells,
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

  if (patternCells.gliderCells.size > 0) {
    context.fillStyle = GLIDER_CELL_COLOR;

    for (const cellKey of patternCells.gliderCells) {
      drawCell(cellKey);
    }
  }

  if (patternCells.lwssCells.size > 0) {
    context.fillStyle = LWSS_CELL_COLOR;

    for (const cellKey of patternCells.lwssCells) {
      drawCell(cellKey);
    }
  }

  if (patternCells.mwssCells.size > 0) {
    context.fillStyle = MWSS_CELL_COLOR;

    for (const cellKey of patternCells.mwssCells) {
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
