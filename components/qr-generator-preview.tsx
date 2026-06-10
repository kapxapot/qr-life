"use client";

import type { LifeGrid } from "@/lib/game-of-life";

const QUIET_ZONE_SIZE = 2;

type Props = {
  seed: LifeGrid;
};

export function QrGeneratorPreview({ seed }: Props) {
  const moduleCount = seed.length;
  const viewBoxSize = moduleCount + QUIET_ZONE_SIZE * 2;
  const darkModules = [];

  for (let rowIndex = 0; rowIndex < seed.length; rowIndex += 1) {
    for (
      let columnIndex = 0;
      columnIndex < seed[rowIndex].length;
      columnIndex += 1
    ) {
      if (!seed[rowIndex]?.[columnIndex]) {
        continue;
      }

      darkModules.push(
        <rect
          fill="black"
          height="1"
          key={`module-${rowIndex}-${columnIndex}`}
          width="1"
          x={columnIndex + QUIET_ZONE_SIZE}
          y={rowIndex + QUIET_ZONE_SIZE}
        />,
      );
    }
  }

  return (
    <svg
      aria-label="Generated QR preview"
      className="h-full w-full rounded-lg bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.8)]"
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
    >
      <rect fill="white" height={viewBoxSize} width={viewBoxSize} x="0" y="0" />
      {darkModules}
    </svg>
  );
}
