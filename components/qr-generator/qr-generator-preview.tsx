"use client";

import type { LifeGrid } from "@/lib/game-of-life/game-of-life";
import { getQrSvgPathData, getQrSvgViewBoxSize } from "@/lib/qr/qr-svg";

type Props = {
  seed: LifeGrid;
};

export function QrGeneratorPreview({ seed }: Props) {
  const viewBoxSize = getQrSvgViewBoxSize(seed);
  const pathData = getQrSvgPathData(seed);

  return (
    <svg
      aria-label="Generated QR preview"
      className="h-full w-full rounded-lg bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.8)]"
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
    >
      <rect fill="white" height={viewBoxSize} width={viewBoxSize} x="0" y="0" />
      {pathData && <path d={pathData} fill="black" />}
    </svg>
  );
}
