import { describe, expect, it } from "vitest";
import {
  getAutofitUniverse,
  getFreeFlyingGliderCells,
  getFreeFlyingPatternCells,
  type LifeUniverse,
  nextGeneration,
} from "../lib/game-of-life";

type Point = {
  x: number;
  y: number;
};

type PatternBounds = {
  height: number;
  width: number;
};

const BASE_GLIDER: readonly Point[] = [
  { x: 1, y: 0 },
  { x: 2, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
];

const BASE_LWSS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: 4, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: 2 },
  { x: 4, y: 2 },
  { x: 0, y: 3 },
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
];

const BASE_MWSS: readonly Point[] = [
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
];

const GLIDER_BOUNDS: PatternBounds = {
  height: 3,
  width: 3,
};

const LWSS_BOUNDS: PatternBounds = {
  height: 4,
  width: 5,
};

const MWSS_BOUNDS: PatternBounds = {
  height: 5,
  width: 6,
};

const TRANSFORMS = {
  identity: ({ x, y }: Point) => ({ x, y }),
  rotate90: ({ x, y }: Point, bounds: PatternBounds) => ({
    x: bounds.height - 1 - y,
    y: x,
  }),
  rotate180: ({ x, y }: Point, bounds: PatternBounds) => ({
    x: bounds.width - 1 - x,
    y: bounds.height - 1 - y,
  }),
  rotate270: ({ x, y }: Point, bounds: PatternBounds) => ({
    x: y,
    y: bounds.width - 1 - x,
  }),
  mirrorHorizontal: ({ x, y }: Point, bounds: PatternBounds) => ({
    x,
    y: bounds.height - 1 - y,
  }),
  mirrorVertical: ({ x, y }: Point, bounds: PatternBounds) => ({
    x: bounds.width - 1 - x,
    y,
  }),
  mirrorMainDiagonal: ({ x, y }: Point) => ({ x: y, y: x }),
  mirrorAntiDiagonal: ({ x, y }: Point, bounds: PatternBounds) => ({
    x: bounds.height - 1 - y,
    y: bounds.width - 1 - x,
  }),
} satisfies Record<string, (point: Point, bounds: PatternBounds) => Point>;

function toCellKey({ x, y }: Point) {
  return `${x}:${y}`;
}

function sortCellKeys(universe: LifeUniverse) {
  return [...universe].sort();
}

function createUniverse(points: readonly Point[]): LifeUniverse {
  return new Set(points.map(toCellKey));
}

function advanceGenerations(universe: LifeUniverse, generations: number) {
  let nextUniverse = universe;

  for (let generation = 0; generation < generations; generation += 1) {
    nextUniverse = nextGeneration(nextUniverse);
  }

  return nextUniverse;
}

function transformPoints(
  points: readonly Point[],
  bounds: PatternBounds,
  transform: (point: Point, bounds: PatternBounds) => Point,
  offsetX = 0,
  offsetY = 0,
) {
  return points.map((point) => {
    const transformed = transform(point, bounds);

    return {
      x: transformed.x + offsetX,
      y: transformed.y + offsetY,
    };
  });
}

describe("getFreeFlyingGliderCells", () => {
  describe.each(Object.entries(TRANSFORMS))("%s", (_name, transform) => {
    it.each([0, 1, 2, 3])("detects isolated gliders in phase %i", (phase) => {
      const startingUniverse = createUniverse(
        transformPoints(BASE_GLIDER, GLIDER_BOUNDS, transform, 20, 20),
      );
      const universe = advanceGenerations(startingUniverse, phase);
      const gliderCells = getFreeFlyingGliderCells(universe);

      expect(gliderCells.size).toBe(5);
      expect(sortCellKeys(gliderCells)).toEqual(sortCellKeys(universe));
    });
  });

  it("does not detect a glider that touches another live cell", () => {
    const universe = createUniverse([
      ...transformPoints(
        BASE_GLIDER,
        GLIDER_BOUNDS,
        TRANSFORMS.identity,
        10,
        10,
      ),
      { x: 10, y: 11 },
    ]);

    expect(getFreeFlyingGliderCells(universe).size).toBe(0);
  });

  it("still detects an isolated glider when unrelated live cells exist elsewhere", () => {
    const glider = createUniverse(
      transformPoints(BASE_GLIDER, GLIDER_BOUNDS, TRANSFORMS.rotate90, 15, 15),
    );
    const universe = new Set([...glider, "40:40", "-12:-9"]);

    expect(sortCellKeys(getFreeFlyingGliderCells(universe))).toEqual(
      sortCellKeys(glider),
    );
  });
});

describe("getFreeFlyingPatternCells", () => {
  describe.each(Object.entries(TRANSFORMS))("%s", (_name, transform) => {
    it.each([0, 1, 2, 3])("detects isolated LWSS in phase %i", (phase) => {
      const startingUniverse = createUniverse(
        transformPoints(BASE_LWSS, LWSS_BOUNDS, transform, 30, 30),
      );
      const universe = advanceGenerations(startingUniverse, phase);
      const patternCells = getFreeFlyingPatternCells(universe);

      expect(patternCells.gliderCells.size).toBe(0);
      expect(patternCells.lwssCells.size).toBe(universe.size);
      expect(sortCellKeys(patternCells.lwssCells)).toEqual(
        sortCellKeys(universe),
      );
      expect(sortCellKeys(patternCells.excludedCells)).toEqual(
        sortCellKeys(universe),
      );
    });
  });

  it("does not detect a LWSS that touches another live cell", () => {
    const universe = createUniverse([
      ...transformPoints(BASE_LWSS, LWSS_BOUNDS, TRANSFORMS.identity, 12, 12),
      { x: 12, y: 11 },
    ]);

    expect(getFreeFlyingPatternCells(universe).lwssCells.size).toBe(0);
  });

  describe.each(Object.entries(TRANSFORMS))("%s", (_name, transform) => {
    it.each([0, 1, 2, 3])("detects isolated MWSS in phase %i", (phase) => {
      const startingUniverse = createUniverse(
        transformPoints(BASE_MWSS, MWSS_BOUNDS, transform, 42, 42),
      );
      const universe = advanceGenerations(startingUniverse, phase);
      const patternCells = getFreeFlyingPatternCells(universe);

      expect(patternCells.gliderCells.size).toBe(0);
      expect(patternCells.lwssCells.size).toBe(0);
      expect(patternCells.mwssCells.size).toBe(universe.size);
      expect(sortCellKeys(patternCells.mwssCells)).toEqual(
        sortCellKeys(universe),
      );
      expect(sortCellKeys(patternCells.excludedCells)).toEqual(
        sortCellKeys(universe),
      );
    });
  });

  it("does not detect a MWSS that touches another live cell", () => {
    const universe = createUniverse([
      ...transformPoints(BASE_MWSS, MWSS_BOUNDS, TRANSFORMS.identity, 12, 12),
      { x: 12, y: 11 },
    ]);

    expect(getFreeFlyingPatternCells(universe).mwssCells.size).toBe(0);
  });
});

describe("getAutofitUniverse", () => {
  it("removes glider, LWSS, and MWSS cells from the autofit universe without mutating inputs", () => {
    const glider = createUniverse(
      transformPoints(BASE_GLIDER, GLIDER_BOUNDS, TRANSFORMS.identity, 5, 5),
    );
    const lwss = createUniverse(
      transformPoints(BASE_LWSS, LWSS_BOUNDS, TRANSFORMS.rotate90, 20, 8),
    );
    const mwss = createUniverse(
      transformPoints(BASE_MWSS, MWSS_BOUNDS, TRANSFORMS.identity, 34, 10),
    );
    const universe = new Set([...glider, ...lwss, ...mwss, "0:0", "1:0"]);
    const patternCells = getFreeFlyingPatternCells(universe);
    const autofitUniverse = getAutofitUniverse(
      universe,
      patternCells.excludedCells,
    );

    expect(sortCellKeys(autofitUniverse)).toEqual(["0:0", "1:0"]);
    expect(patternCells.gliderCells.size).toBe(5);
    expect(patternCells.lwssCells.size).toBe(9);
    expect(patternCells.mwssCells.size).toBe(11);
    expect(universe.size).toBe(27);
    expect(glider.size).toBe(5);
    expect(lwss.size).toBe(9);
    expect(mwss.size).toBe(11);
  });
});
