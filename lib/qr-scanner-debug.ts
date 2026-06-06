import type { JsQrLocation } from "@/lib/jsqr";
import { jsQr } from "@/lib/jsqr";

type Point = {
  x: number;
  y: number;
};

export type DetectionPlausibility = {
  aspectRatio: number;
  averageHeight: number;
  averageWidth: number;
  centerX: number;
  centerY: number;
  inBounds: boolean;
  isCentered: boolean;
  isValid: boolean;
  qrAreaRatio: number;
};

export type ScannerDebugStage =
  | "waiting-for-frame"
  | "no-qr-located"
  | "located-but-undecodable"
  | "decoded-empty"
  | "decoded-but-rejected"
  | "scan-complete";

export type ScannerDebugSnapshot = {
  confirmationHits: number;
  frameHeight: number | null;
  frameWidth: number | null;
  invertedLocationCount: number;
  locationCount: number;
  normalizedValueLength: number | null;
  plausibility: DetectionPlausibility | null;
  rejectionReason: string | null;
  stage: ScannerDebugStage;
  version: number | null;
};

const DEBUG_STAGE_LABELS = {
  "decoded-but-rejected": "Decoded, then filtered",
  "decoded-empty": "Decoded empty payload",
  "located-but-undecodable": "Locate passed, decode failed",
  "no-qr-located": "Locate failed",
  "scan-complete": "Scan complete",
  "waiting-for-frame": "Waiting for frame",
} satisfies Record<ScannerDebugStage, string>;

export function createInitialDebugSnapshot(): ScannerDebugSnapshot {
  return {
    confirmationHits: 0,
    frameHeight: null,
    frameWidth: null,
    invertedLocationCount: 0,
    locationCount: 0,
    normalizedValueLength: null,
    plausibility: null,
    rejectionReason: null,
    stage: "waiting-for-frame",
    version: null,
  };
}

function getPointDistance(firstPoint: Point, secondPoint: Point) {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

export function getDetectionPlausibility(
  location: JsQrLocation,
  width: number,
  height: number,
): DetectionPlausibility {
  const points = [
    location.topLeftCorner,
    location.topRightCorner,
    location.bottomRightCorner,
    location.bottomLeftCorner,
  ];

  if (
    points.some(
      ({ x, y }) =>
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        y < 0 ||
        x > width ||
        y > height,
    )
  ) {
    return {
      aspectRatio: 0,
      averageHeight: 0,
      averageWidth: 0,
      centerX: 0,
      centerY: 0,
      inBounds: false,
      isCentered: false,
      isValid: false,
      qrAreaRatio: 0,
    };
  }

  const topWidth = getPointDistance(
    location.topLeftCorner,
    location.topRightCorner,
  );
  const bottomWidth = getPointDistance(
    location.bottomLeftCorner,
    location.bottomRightCorner,
  );
  const leftHeight = getPointDistance(
    location.topLeftCorner,
    location.bottomLeftCorner,
  );
  const rightHeight = getPointDistance(
    location.topRightCorner,
    location.bottomRightCorner,
  );
  const averageWidth = (topWidth + bottomWidth) / 2;
  const averageHeight = (leftHeight + rightHeight) / 2;
  const frameArea = width * height;
  const qrAreaRatio = (averageWidth * averageHeight) / Math.max(frameArea, 1);
  const aspectRatio = averageWidth / Math.max(averageHeight, 1);
  const centerX =
    (location.topLeftCorner.x +
      location.topRightCorner.x +
      location.bottomLeftCorner.x +
      location.bottomRightCorner.x) /
    4;
  const centerY =
    (location.topLeftCorner.y +
      location.topRightCorner.y +
      location.bottomLeftCorner.y +
      location.bottomRightCorner.y) /
    4;
  const isCentered =
    centerX >= width * 0.15 &&
    centerX <= width * 0.85 &&
    centerY >= height * 0.15 &&
    centerY <= height * 0.85;

  return {
    aspectRatio,
    averageHeight,
    averageWidth,
    centerX,
    centerY,
    inBounds: true,
    isCentered,
    isValid:
      qrAreaRatio >= 0.01 &&
      aspectRatio >= 0.55 &&
      aspectRatio <= 1.8 &&
      isCentered,
    qrAreaRatio,
  };
}

export function getPlausibilityRejectionReason(
  plausibility: DetectionPlausibility,
) {
  if (!plausibility.inBounds) {
    return "The detected corners fall outside the sampled frame.";
  }

  if (plausibility.qrAreaRatio < 0.01) {
    return "The detected QR covers under 1% of the frame, so it is too small or too distant.";
  }

  if (plausibility.aspectRatio < 0.55 || plausibility.aspectRatio > 1.8) {
    return "The detected shape is too skewed to trust as a square QR.";
  }

  if (!plausibility.isCentered) {
    return "The detected QR is too close to the frame edge.";
  }

  return "The detection failed the scanner plausibility filter.";
}
export function formatDebugStage(stage: ScannerDebugStage) {
  return DEBUG_STAGE_LABELS[stage];
}

export function formatPercent(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)}%`;
}

export function getQrLocationDiagnostics(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const { binarized, inverted } = jsQr.binarize(data, width, height, true);

  return {
    invertedLocationCount: inverted ? (jsQr.locate(inverted)?.length ?? 0) : 0,
    locationCount: jsQr.locate(binarized)?.length ?? 0,
  };
}
