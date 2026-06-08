import { describe, expect, it } from "vitest";
import {
  getAutofitUniverse,
  getFreeFlyingGliderCells,
  type LifeUniverse,
  nextGeneration,
} from "../lib/game-of-life";

type Point = {
  x: number;
  y: number;
};

const BASE_GLIDER: readonly Point[] = [
  { x: 1, y: 0 },
  { x: 2, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
];

const TRANSFORMS = {
  identity: ({ x, y }: Point) => ({ x, y }),
  rotate90: ({ x, y }: Point) => ({ x: 2 - y, y: x }),
  rotate180: ({ x, y }: Point) => ({ x: 2 - x, y: 2 - y }),
  rotate270: ({ x, y }: Point) => ({ x: y, y: 2 - x }),
  mirrorHorizontal: ({ x, y }: Point) => ({ x, y: 2 - y }),
  mirrorVertical: ({ x, y }: Point) => ({ x: 2 - x, y }),
  mirrorMainDiagonal: ({ x, y }: Point) => ({ x: y, y: x }),
  mirrorAntiDiagonal: ({ x, y }: Point) => ({ x: 2 - y, y: 2 - x }),
} satisfies Record<string, (point: Point) => Point>;

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
  transform: (point: Point) => Point,
  offsetX = 0,
  offsetY = 0,
) {
  return points.map((point) => {
    const transformed = transform(point);

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
        transformPoints(BASE_GLIDER, transform, 20, 20),
      );
      const universe = advanceGenerations(startingUniverse, phase);
      const gliderCells = getFreeFlyingGliderCells(universe);

      expect(gliderCells.size).toBe(5);
      expect(sortCellKeys(gliderCells)).toEqual(sortCellKeys(universe));
    });
  });

  it("does not detect a glider that touches another live cell", () => {
    const universe = createUniverse([
      ...transformPoints(BASE_GLIDER, TRANSFORMS.identity, 10, 10),
      { x: 10, y: 11 },
    ]);

    expect(getFreeFlyingGliderCells(universe).size).toBe(0);
  });

  it("still detects an isolated glider when unrelated live cells exist elsewhere", () => {
    const glider = createUniverse(
      transformPoints(BASE_GLIDER, TRANSFORMS.rotate90, 15, 15),
    );
    const universe = new Set([...glider, "40:40", "-12:-9"]);

    expect(sortCellKeys(getFreeFlyingGliderCells(universe))).toEqual(
      sortCellKeys(glider),
    );
  });
});

describe("getAutofitUniverse", () => {
  it("removes glider cells from the autofit universe without mutating inputs", () => {
    const glider = createUniverse(
      transformPoints(BASE_GLIDER, TRANSFORMS.identity, 5, 5),
    );
    const universe = new Set([...glider, "0:0", "1:0"]);
    const autofitUniverse = getAutofitUniverse(universe, glider);

    expect(sortCellKeys(autofitUniverse)).toEqual(["0:0", "1:0"]);
    expect(universe.size).toBe(7);
    expect(glider.size).toBe(5);
  });
});
