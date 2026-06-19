import {
  type FreeFlyingPatternCells,
  getAutofitUniverse,
  getUniverseBounds,
  type LifeUniverse,
  type UniverseBounds,
} from "@/lib/game-of-life";

export type LifeDebugSnapshot = {
  autofitBounds: UniverseBounds | null;
  autofitEdgeCells: LifeUniverse;
  autofitLiveCount: number;
  autofitTargetSpan: number | null;
  gliderCount: number;
  lwssCount: number;
  universeBounds: UniverseBounds | null;
  universeLiveCount: number;
  viewportBaseSpan: number;
};

type CreateLifeDebugSnapshotOptions = {
  autofitTargetSpan: number | null;
  patternCells: FreeFlyingPatternCells;
  universe: LifeUniverse;
  viewportBaseSpan: number;
};

function getBoundsEdgeCells(
  universe: LifeUniverse,
  bounds: UniverseBounds | null,
): LifeUniverse {
  if (!bounds) {
    return new Set<string>();
  }

  const edgeCells = new Set<string>();

  for (const cellKey of universe) {
    const [xValue = "0", yValue = "0"] = cellKey.split(":");
    const x = Number(xValue);
    const y = Number(yValue);

    if (
      x === bounds.minX ||
      x === bounds.maxX ||
      y === bounds.minY ||
      y === bounds.maxY
    ) {
      edgeCells.add(cellKey);
    }
  }

  return edgeCells;
}

export function formatLifeBounds(bounds: UniverseBounds | null) {
  if (!bounds) {
    return "none";
  }

  return `${bounds.minX},${bounds.minY} -> ${bounds.maxX},${bounds.maxY}`;
}

export function createLifeDebugSnapshot({
  autofitTargetSpan,
  patternCells,
  universe,
  viewportBaseSpan,
}: CreateLifeDebugSnapshotOptions): LifeDebugSnapshot {
  const autofitUniverse = getAutofitUniverse(
    universe,
    patternCells.excludedCells,
  );
  const autofitBounds = getUniverseBounds(autofitUniverse);

  return {
    autofitBounds,
    autofitEdgeCells: getBoundsEdgeCells(autofitUniverse, autofitBounds),
    autofitLiveCount: autofitUniverse.size,
    autofitTargetSpan,
    gliderCount: patternCells.gliderCells.size,
    lwssCount: patternCells.lwssCells.size,
    universeBounds: getUniverseBounds(universe),
    universeLiveCount: universe.size,
    viewportBaseSpan,
  };
}
