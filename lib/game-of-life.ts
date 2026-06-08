export type LifeGrid = boolean[][];
export type LifeUniverse = Set<string>;

export type UniverseBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

type NormalizedUniverseShape = UniverseBounds & {
  signature: string;
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

export function getAutofitUniverse(
  universe: LifeUniverse,
  gliderCells: LifeUniverse,
): LifeUniverse {
  if (gliderCells.size === 0) {
    return universe;
  }

  const autofitUniverse = new Set<string>();

  for (const cellKey of universe) {
    if (!gliderCells.has(cellKey)) {
      autofitUniverse.add(cellKey);
    }
  }

  return autofitUniverse;
}

function collectConnectedComponent(
  universe: LifeUniverse,
  startCellKey: string,
  visited: Set<string>,
): LifeUniverse {
  const component = new Set<string>();
  const pendingCellKeys = [startCellKey];

  visited.add(startCellKey);

  while (pendingCellKeys.length > 0) {
    const cellKey = pendingCellKeys.pop();

    if (!cellKey) {
      continue;
    }

    component.add(cellKey);

    const { x, y } = fromCellKey(cellKey);

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        if (rowOffset === 0 && columnOffset === 0) {
          continue;
        }

        const neighborKey = toCellKey(x + columnOffset, y + rowOffset);

        if (!universe.has(neighborKey) || visited.has(neighborKey)) {
          continue;
        }

        visited.add(neighborKey);
        pendingCellKeys.push(neighborKey);
      }
    }
  }

  return component;
}

function normalizeUniverseShape(
  universe: LifeUniverse,
): NormalizedUniverseShape | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const coordinates: CellPosition[] = [];

  for (const cellKey of universe) {
    const { x, y } = fromCellKey(cellKey);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    coordinates.push({ x, y });
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  coordinates.sort((left, right) => left.y - right.y || left.x - right.x);

  return {
    maxX,
    maxY,
    minX,
    minY,
    signature: coordinates
      .map(({ x, y }) => `${x - minX}:${y - minY}`)
      .join("|"),
  };
}

function isFreeFlyingGliderComponent(component: LifeUniverse): boolean {
  if (component.size !== 5) {
    return false;
  }

  const initialShape = normalizeUniverseShape(component);

  if (!initialShape) {
    return false;
  }

  const spanX = initialShape.maxX - initialShape.minX + 1;
  const spanY = initialShape.maxY - initialShape.minY + 1;

  if (spanX > 3 || spanY > 3) {
    return false;
  }

  let nextComponent = cloneUniverse(component);

  for (let generation = 0; generation < 4; generation += 1) {
    nextComponent = nextGeneration(nextComponent);

    if (nextComponent.size !== 5) {
      return false;
    }
  }

  const nextShape = normalizeUniverseShape(nextComponent);

  if (!nextShape) {
    return false;
  }

  return (
    initialShape.signature === nextShape.signature &&
    Math.abs(nextShape.minX - initialShape.minX) === 1 &&
    Math.abs(nextShape.minY - initialShape.minY) === 1
  );
}

export function getFreeFlyingGliderCells(universe: LifeUniverse): LifeUniverse {
  const gliderCells = new Set<string>();
  const visited = new Set<string>();

  for (const cellKey of universe) {
    if (visited.has(cellKey)) {
      continue;
    }

    const component = collectConnectedComponent(universe, cellKey, visited);

    if (!isFreeFlyingGliderComponent(component)) {
      continue;
    }

    for (const gliderCellKey of component) {
      gliderCells.add(gliderCellKey);
    }
  }

  return gliderCells;
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
