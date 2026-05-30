export type LifeGrid = boolean[][];
export type LifeUniverse = Set<string>;

export type UniverseBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

type CellPosition = {
  x: number;
  y: number;
};

function toCellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function fromCellKey(key: string): CellPosition {
  const [xValue = "0", yValue = "0"] = key.split(":");

  return {
    x: Number(xValue),
    y: Number(yValue),
  };
}

export function createUniverseFromSeed(seed: LifeGrid): LifeUniverse {
  const rowCount = seed.length;
  const columnCount = seed[0]?.length ?? 0;
  const offsetX = -Math.floor(columnCount / 2);
  const offsetY = -Math.floor(rowCount / 2);
  const universe = new Set<string>();

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      if (!seed[rowIndex]?.[columnIndex]) {
        continue;
      }

      universe.add(toCellKey(offsetX + columnIndex, offsetY + rowIndex));
    }
  }

  return universe;
}

export function cloneUniverse(universe: LifeUniverse): LifeUniverse {
  return new Set(universe);
}

export function countPopulation(universe: LifeUniverse): number {
  return universe.size;
}

export function nextGeneration(universe: LifeUniverse): LifeUniverse {
  const neighborCounts = new Map<string, number>();

  for (const cellKey of universe) {
    const { x, y } = fromCellKey(cellKey);

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        if (rowOffset === 0 && columnOffset === 0) {
          continue;
        }

        const neighborKey = toCellKey(x + columnOffset, y + rowOffset);
        const currentCount = neighborCounts.get(neighborKey) ?? 0;

        neighborCounts.set(neighborKey, currentCount + 1);
      }
    }
  }

  const nextUniverse = new Set<string>();

  for (const [cellKey, neighborCount] of neighborCounts) {
    const isAlive = universe.has(cellKey);

    if (neighborCount === 3 || (isAlive && neighborCount === 2)) {
      nextUniverse.add(cellKey);
    }
  }

  return nextUniverse;
}

export function getUniverseBounds(
  universe: LifeUniverse,
): UniverseBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const cellKey of universe) {
    const { x, y } = fromCellKey(cellKey);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return {
    maxX,
    maxY,
    minX,
    minY,
  };
}

export function hasLiveCell(
  universe: LifeUniverse,
  x: number,
  y: number,
): boolean {
  return universe.has(toCellKey(x, y));
}
