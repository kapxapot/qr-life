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

type PatternSpan = {
  x: number;
  y: number;
};

type FreeFlyingPatternDescriptor = {
  isExpectedTranslation: (deltaX: number, deltaY: number) => boolean;
  neighborRadius: number;
  phasePopulations: readonly number[];
  period: number;
  spans: readonly PatternSpan[];
};

export type FreeFlyingPatternCells = {
  excludedCells: LifeUniverse;
  gliderCells: LifeUniverse;
  lwssCells: LifeUniverse;
  mwssCells: LifeUniverse;
};

const GLIDER_PATTERN: FreeFlyingPatternDescriptor = {
  isExpectedTranslation: (deltaX, deltaY) =>
    Math.abs(deltaX) === 1 && Math.abs(deltaY) === 1,
  neighborRadius: 1,
  phasePopulations: [5],
  period: 4,
  spans: [{ x: 3, y: 3 }],
};

const LWSS_PATTERN: FreeFlyingPatternDescriptor = {
  isExpectedTranslation: (deltaX, deltaY) =>
    (Math.abs(deltaX) === 2 && deltaY === 0) ||
    (deltaX === 0 && Math.abs(deltaY) === 2),
  neighborRadius: 2,
  phasePopulations: [9, 12],
  period: 4,
  spans: [
    { x: 4, y: 5 },
    { x: 5, y: 4 },
  ],
};

const MWSS_PATTERN: FreeFlyingPatternDescriptor = {
  isExpectedTranslation: (deltaX, deltaY) =>
    (Math.abs(deltaX) === 2 && deltaY === 0) ||
    (deltaX === 0 && Math.abs(deltaY) === 2),
  neighborRadius: 2,
  phasePopulations: [11, 15],
  period: 4,
  spans: [
    { x: 6, y: 5 },
    { x: 5, y: 6 },
    { x: 6, y: 4 },
    { x: 4, y: 6 },
  ],
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

function addUniverseCells(target: LifeUniverse, source: LifeUniverse) {
  for (const cellKey of source) {
    target.add(cellKey);
  }
}

function createEmptyFreeFlyingPatternCells(): FreeFlyingPatternCells {
  return {
    excludedCells: new Set<string>(),
    gliderCells: new Set<string>(),
    lwssCells: new Set<string>(),
    mwssCells: new Set<string>(),
  };
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
  excludedCells: LifeUniverse,
): LifeUniverse {
  if (excludedCells.size === 0) {
    return universe;
  }

  const autofitUniverse = new Set<string>();

  for (const cellKey of universe) {
    if (!excludedCells.has(cellKey)) {
      autofitUniverse.add(cellKey);
    }
  }

  return autofitUniverse;
}

function collectConnectedComponent(
  universe: LifeUniverse,
  startCellKey: string,
  visited: Set<string>,
  neighborRadius = 1,
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

    for (
      let rowOffset = -neighborRadius;
      rowOffset <= neighborRadius;
      rowOffset += 1
    ) {
      for (
        let columnOffset = -neighborRadius;
        columnOffset <= neighborRadius;
        columnOffset += 1
      ) {
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

function matchesPatternSpan(
  spans: readonly PatternSpan[],
  spanX: number,
  spanY: number,
) {
  return spans.some((span) => span.x === spanX && span.y === spanY);
}

function isSingleConnectedComponent(
  universe: LifeUniverse,
  neighborRadius: number,
) {
  const [startCellKey] = universe;

  if (!startCellKey) {
    return false;
  }

  const visited = new Set<string>();
  const component = collectConnectedComponent(
    universe,
    startCellKey,
    visited,
    neighborRadius,
  );

  return component.size === universe.size;
}

function isFreeFlyingPatternComponent(
  component: LifeUniverse,
  pattern: FreeFlyingPatternDescriptor,
): boolean {
  if (!pattern.phasePopulations.includes(component.size)) {
    return false;
  }

  const initialShape = normalizeUniverseShape(component);

  if (!initialShape) {
    return false;
  }

  const spanX = initialShape.maxX - initialShape.minX + 1;
  const spanY = initialShape.maxY - initialShape.minY + 1;

  if (!matchesPatternSpan(pattern.spans, spanX, spanY)) {
    return false;
  }

  let nextComponent = cloneUniverse(component);

  for (let generation = 0; generation < pattern.period; generation += 1) {
    nextComponent = nextGeneration(nextComponent);

    if (!pattern.phasePopulations.includes(nextComponent.size)) {
      return false;
    }

    if (!isSingleConnectedComponent(nextComponent, pattern.neighborRadius)) {
      return false;
    }

    const nextPhaseShape = normalizeUniverseShape(nextComponent);

    if (!nextPhaseShape) {
      return false;
    }

    const nextSpanX = nextPhaseShape.maxX - nextPhaseShape.minX + 1;
    const nextSpanY = nextPhaseShape.maxY - nextPhaseShape.minY + 1;

    if (!matchesPatternSpan(pattern.spans, nextSpanX, nextSpanY)) {
      return false;
    }
  }

  const nextShape = normalizeUniverseShape(nextComponent);

  if (!nextShape) {
    return false;
  }

  return (
    initialShape.signature === nextShape.signature &&
    pattern.isExpectedTranslation(
      nextShape.minX - initialShape.minX,
      nextShape.minY - initialShape.minY,
    )
  );
}

function getFreeFlyingPatternCellsByComponent(
  universe: LifeUniverse,
  pattern: FreeFlyingPatternDescriptor,
): LifeUniverse {
  const patternCells = new Set<string>();
  const visited = new Set<string>();

  for (const cellKey of universe) {
    if (visited.has(cellKey)) {
      continue;
    }

    const component = collectConnectedComponent(
      universe,
      cellKey,
      visited,
      pattern.neighborRadius,
    );

    if (!isFreeFlyingPatternComponent(component, pattern)) {
      continue;
    }

    addUniverseCells(patternCells, component);
  }

  return patternCells;
}

export function getFreeFlyingPatternCells(
  universe: LifeUniverse,
): FreeFlyingPatternCells {
  const detectedPatterns = createEmptyFreeFlyingPatternCells();

  detectedPatterns.gliderCells = getFreeFlyingPatternCellsByComponent(
    universe,
    GLIDER_PATTERN,
  );
  detectedPatterns.lwssCells = getFreeFlyingPatternCellsByComponent(
    universe,
    LWSS_PATTERN,
  );
  detectedPatterns.mwssCells = getFreeFlyingPatternCellsByComponent(
    universe,
    MWSS_PATTERN,
  );
  addUniverseCells(
    detectedPatterns.excludedCells,
    detectedPatterns.gliderCells,
  );
  addUniverseCells(detectedPatterns.excludedCells, detectedPatterns.lwssCells);
  addUniverseCells(detectedPatterns.excludedCells, detectedPatterns.mwssCells);

  return detectedPatterns;
}

export function getFreeFlyingGliderCells(universe: LifeUniverse): LifeUniverse {
  return getFreeFlyingPatternCells(universe).gliderCells;
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
