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

type PatternBounds = {
  height: number;
  width: number;
};

type FreeFlyingPatternDescriptor = {
  cycleSignatureKeys: ReadonlySet<string>;
  isExpectedTranslation: (deltaX: number, deltaY: number) => boolean;
  leadInSignatureKeys: ReadonlySet<string>;
  neighborRadius: number;
  period: number;
};

export type FreeFlyingPatternCells = {
  excludedCells: LifeUniverse;
  gliderCells: LifeUniverse;
  hwssCells: LifeUniverse;
  lwssCells: LifeUniverse;
  mwssCells: LifeUniverse;
};

const GLIDER_BOUNDS: PatternBounds = {
  height: 3,
  width: 3,
};

const GLIDER_CELLS = [
  { x: 1, y: 0 },
  { x: 2, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
] as const satisfies readonly CellPosition[];

const LWSS_BOUNDS: PatternBounds = {
  height: 4,
  width: 5,
};

const LWSS_CELLS = [
  { x: 1, y: 0 },
  { x: 4, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: 2 },
  { x: 4, y: 2 },
  { x: 0, y: 3 },
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
] as const satisfies readonly CellPosition[];

const CLEAN_LWSS_LEAD_IN_CELLS = [
  [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 4, y: 2 },
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ],
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 3 },
  ],
] as const satisfies readonly (readonly CellPosition[])[];

const MWSS_BOUNDS: PatternBounds = {
  height: 5,
  width: 6,
};

const MWSS_CELLS = [
  { x: 3, y: 0 },
  { x: 1, y: 1 },
  { x: 5, y: 1 },
  { x: 0, y: 2 },
  { x: 0, y: 3 },
  { x: 5, y: 3 },
  { x: 0, y: 4 },
  { x: 1, y: 4 },
  { x: 2, y: 4 },
  { x: 3, y: 4 },
  { x: 4, y: 4 },
] as const satisfies readonly CellPosition[];

const CLEAN_MWSS_LEAD_IN_CELLS = [
  [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 5, y: 2 },
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ],
  [
    { x: 1, y: 0 },
    { x: 5, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 5, y: 2 },
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ],
  [
    { x: 3, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 2 },
    { x: 0, y: 3 },
    { x: 5, y: 3 },
    { x: 0, y: 4 },
    { x: 1, y: 4 },
    { x: 2, y: 4 },
    { x: 3, y: 4 },
    { x: 4, y: 4 },
  ],
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 1 },
    { x: 5, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 3 },
    { x: 3, y: 4 },
  ],
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 1 },
    { x: 5, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 3 },
    { x: 5, y: 3 },
  ],
] as const satisfies readonly (readonly CellPosition[])[];

const HWSS_BOUNDS: PatternBounds = {
  height: 5,
  width: 7,
};

const HWSS_CELLS = [
  { x: 3, y: 0 },
  { x: 4, y: 0 },
  { x: 1, y: 1 },
  { x: 6, y: 1 },
  { x: 0, y: 2 },
  { x: 0, y: 3 },
  { x: 6, y: 3 },
  { x: 0, y: 4 },
  { x: 1, y: 4 },
  { x: 2, y: 4 },
  { x: 3, y: 4 },
  { x: 4, y: 4 },
  { x: 5, y: 4 },
] as const satisfies readonly CellPosition[];

const BASIC_HWSS_LEAD_IN_CELLS = [
  [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 6, y: 2 },
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
    { x: 5, y: 3 },
  ],
  [
    { x: 1, y: 0 },
    { x: 6, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 6, y: 2 },
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
    { x: 5, y: 3 },
  ],
] as const satisfies readonly (readonly CellPosition[])[];

type PatternTransform = (
  point: CellPosition,
  bounds: PatternBounds,
) => CellPosition;

const PATTERN_TRANSFORMS = [
  ({ x, y }: CellPosition) => ({ x, y }),
  ({ x, y }: CellPosition, bounds: PatternBounds) => ({
    x: bounds.height - 1 - y,
    y: x,
  }),
  ({ x, y }: CellPosition, bounds: PatternBounds) => ({
    x: bounds.width - 1 - x,
    y: bounds.height - 1 - y,
  }),
  ({ x, y }: CellPosition, bounds: PatternBounds) => ({
    x: y,
    y: bounds.width - 1 - x,
  }),
  ({ x, y }: CellPosition, bounds: PatternBounds) => ({
    x,
    y: bounds.height - 1 - y,
  }),
  ({ x, y }: CellPosition, bounds: PatternBounds) => ({
    x: bounds.width - 1 - x,
    y,
  }),
  ({ x, y }: CellPosition) => ({ x: y, y: x }),
  ({ x, y }: CellPosition, bounds: PatternBounds) => ({
    x: bounds.height - 1 - y,
    y: bounds.width - 1 - x,
  }),
] as const satisfies readonly PatternTransform[];

function toCellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function createUniverseFromPoints(
  points: readonly CellPosition[],
): LifeUniverse {
  return new Set(points.map(({ x, y }) => toCellKey(x, y)));
}

export function getLifeCellKey(x: number, y: number) {
  return toCellKey(x, y);
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
    hwssCells: new Set<string>(),
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

function getShapeSignatureKey(shape: NormalizedUniverseShape) {
  return `${shape.maxX - shape.minX + 1}x${shape.maxY - shape.minY + 1}:${shape.signature}`;
}

function transformPatternPoints(
  points: readonly CellPosition[],
  bounds: PatternBounds,
  transform: PatternTransform,
) {
  return points.map((point) => transform(point, bounds));
}

function collectCycleSignatureKeys(
  points: readonly CellPosition[],
  bounds: PatternBounds,
  period: number,
) {
  const signatureKeys = new Set<string>();

  for (const transform of PATTERN_TRANSFORMS) {
    let phaseUniverse = createUniverseFromPoints(
      transformPatternPoints(points, bounds, transform),
    );

    for (let generation = 0; generation < period; generation += 1) {
      const shape = normalizeUniverseShape(phaseUniverse);

      if (shape) {
        signatureKeys.add(getShapeSignatureKey(shape));
      }

      phaseUniverse = nextGeneration(phaseUniverse);
    }
  }

  return signatureKeys;
}

function collectStaticSignatureKeys(
  states: readonly (readonly CellPosition[])[],
  bounds: PatternBounds,
) {
  const signatureKeys = new Set<string>();

  for (const points of states) {
    for (const transform of PATTERN_TRANSFORMS) {
      const shape = normalizeUniverseShape(
        createUniverseFromPoints(
          transformPatternPoints(points, bounds, transform),
        ),
      );

      if (shape) {
        signatureKeys.add(getShapeSignatureKey(shape));
      }
    }
  }

  return signatureKeys;
}

function createFreeFlyingPatternDescriptor({
  bounds,
  cycleCells,
  isExpectedTranslation,
  leadInCells = [],
  neighborRadius,
  period,
}: {
  bounds: PatternBounds;
  cycleCells: readonly CellPosition[];
  isExpectedTranslation: (deltaX: number, deltaY: number) => boolean;
  leadInCells?: readonly (readonly CellPosition[])[];
  neighborRadius: number;
  period: number;
}): FreeFlyingPatternDescriptor {
  return {
    cycleSignatureKeys: collectCycleSignatureKeys(cycleCells, bounds, period),
    isExpectedTranslation,
    leadInSignatureKeys: collectStaticSignatureKeys(leadInCells, bounds),
    neighborRadius,
    period,
  };
}

const GLIDER_PATTERN = createFreeFlyingPatternDescriptor({
  bounds: GLIDER_BOUNDS,
  cycleCells: GLIDER_CELLS,
  isExpectedTranslation: (deltaX, deltaY) =>
    Math.abs(deltaX) === 1 && Math.abs(deltaY) === 1,
  neighborRadius: 1,
  period: 4,
});

const LWSS_PATTERN = createFreeFlyingPatternDescriptor({
  bounds: LWSS_BOUNDS,
  cycleCells: LWSS_CELLS,
  isExpectedTranslation: (deltaX, deltaY) =>
    (Math.abs(deltaX) === 2 && deltaY === 0) ||
    (deltaX === 0 && Math.abs(deltaY) === 2),
  leadInCells: CLEAN_LWSS_LEAD_IN_CELLS,
  neighborRadius: 2,
  period: 4,
});

const MWSS_PATTERN = createFreeFlyingPatternDescriptor({
  bounds: MWSS_BOUNDS,
  cycleCells: MWSS_CELLS,
  isExpectedTranslation: (deltaX, deltaY) =>
    (Math.abs(deltaX) === 2 && deltaY === 0) ||
    (deltaX === 0 && Math.abs(deltaY) === 2),
  leadInCells: CLEAN_MWSS_LEAD_IN_CELLS,
  neighborRadius: 2,
  period: 4,
});

const HWSS_PATTERN = createFreeFlyingPatternDescriptor({
  bounds: HWSS_BOUNDS,
  cycleCells: HWSS_CELLS,
  isExpectedTranslation: (deltaX, deltaY) =>
    (Math.abs(deltaX) === 2 && deltaY === 0) ||
    (deltaX === 0 && Math.abs(deltaY) === 2),
  leadInCells: BASIC_HWSS_LEAD_IN_CELLS,
  neighborRadius: 2,
  period: 4,
});

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
  const initialShape = normalizeUniverseShape(component);

  if (!initialShape) {
    return false;
  }

  const initialSignatureKey = getShapeSignatureKey(initialShape);
  const isCanonicalStart = pattern.cycleSignatureKeys.has(initialSignatureKey);
  const isLeadInStart = pattern.leadInSignatureKeys.has(initialSignatureKey);

  if (!isCanonicalStart && !isLeadInStart) {
    return false;
  }

  let cycleStartComponent = cloneUniverse(component);

  if (isLeadInStart) {
    cycleStartComponent = nextGeneration(cycleStartComponent);

    if (
      !isSingleConnectedComponent(cycleStartComponent, pattern.neighborRadius)
    ) {
      return false;
    }

    const cycleStartShape = normalizeUniverseShape(cycleStartComponent);

    if (
      !cycleStartShape ||
      !pattern.cycleSignatureKeys.has(getShapeSignatureKey(cycleStartShape))
    ) {
      return false;
    }
  }

  const cycleStartShape = normalizeUniverseShape(cycleStartComponent);

  if (!cycleStartShape) {
    return false;
  }

  let nextComponent = cloneUniverse(cycleStartComponent);

  for (let generation = 0; generation < pattern.period; generation += 1) {
    nextComponent = nextGeneration(nextComponent);

    if (!isSingleConnectedComponent(nextComponent, pattern.neighborRadius)) {
      return false;
    }

    const nextPhaseShape = normalizeUniverseShape(nextComponent);

    if (
      !nextPhaseShape ||
      !pattern.cycleSignatureKeys.has(getShapeSignatureKey(nextPhaseShape))
    ) {
      return false;
    }
  }

  const nextShape = normalizeUniverseShape(nextComponent);

  if (!nextShape) {
    return false;
  }

  return (
    cycleStartShape.signature === nextShape.signature &&
    pattern.isExpectedTranslation(
      nextShape.minX - cycleStartShape.minX,
      nextShape.minY - cycleStartShape.minY,
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
  detectedPatterns.hwssCells = getFreeFlyingPatternCellsByComponent(
    universe,
    HWSS_PATTERN,
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
  addUniverseCells(detectedPatterns.excludedCells, detectedPatterns.hwssCells);
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

export function toggleLifeCell(universe: LifeUniverse, x: number, y: number) {
  const cellKey = toCellKey(x, y);

  if (universe.has(cellKey)) {
    universe.delete(cellKey);
    return;
  }

  universe.add(cellKey);
}
