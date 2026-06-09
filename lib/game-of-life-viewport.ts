import type { UniverseBounds } from "@/lib/game-of-life";

export type ViewportCenter = {
  x: number;
  y: number;
};

export function normalizeViewportSpanForAxis(span: number) {
  return Math.max(1, Math.ceil(span));
}

export function getViewportSpans(
  baseSpan: number,
  zoomFactor: number,
  renderedCanvasWidth: number,
  renderedCanvasHeight: number,
) {
  const nextBaseSpan = Math.max(1, baseSpan / zoomFactor);

  if (renderedCanvasWidth >= renderedCanvasHeight) {
    const spanY = normalizeViewportSpanForAxis(nextBaseSpan);
    const spanX = normalizeViewportSpanForAxis(
      (spanY * renderedCanvasWidth) / renderedCanvasHeight,
    );

    return { spanX, spanY };
  }

  const spanX = normalizeViewportSpanForAxis(nextBaseSpan);
  const spanY = normalizeViewportSpanForAxis(
    (spanX * renderedCanvasHeight) / renderedCanvasWidth,
  );

  return { spanX, spanY };
}

export function getRequiredViewportBaseSpanForBounds(
  bounds: UniverseBounds,
  renderedCanvasWidth: number,
  renderedCanvasHeight: number,
  minViewportSpan: number,
) {
  const requiredSpanX = normalizeViewportSpanForAxis(
    Math.max(minViewportSpan, bounds.maxX - bounds.minX + 1),
  );
  const requiredSpanY = normalizeViewportSpanForAxis(
    Math.max(minViewportSpan, bounds.maxY - bounds.minY + 1),
  );

  if (renderedCanvasWidth >= renderedCanvasHeight) {
    return normalizeViewportSpanForAxis(
      Math.max(
        requiredSpanY,
        (requiredSpanX * renderedCanvasHeight) / renderedCanvasWidth,
      ),
    );
  }

  return normalizeViewportSpanForAxis(
    Math.max(
      requiredSpanX,
      (requiredSpanY * renderedCanvasWidth) / renderedCanvasHeight,
    ),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getViewportCenterForBounds(
  currentCenter: ViewportCenter,
  bounds: UniverseBounds,
  spanX: number,
  spanY: number,
): ViewportCenter {
  const halfSpanX = (spanX - 1) / 2;
  const halfSpanY = (spanY - 1) / 2;
  const minCenterX = bounds.maxX - halfSpanX;
  const maxCenterX = bounds.minX + halfSpanX;
  const minCenterY = bounds.maxY - halfSpanY;
  const maxCenterY = bounds.minY + halfSpanY;

  return {
    x:
      minCenterX <= maxCenterX
        ? clamp(currentCenter.x, minCenterX, maxCenterX)
        : (bounds.minX + bounds.maxX) / 2,
    y:
      minCenterY <= maxCenterY
        ? clamp(currentCenter.y, minCenterY, maxCenterY)
        : (bounds.minY + bounds.maxY) / 2,
  };
}
