import { describe, expect, it } from "vitest";
import {
  getLifeCellCoordinatesFromWorldPoint,
  getLifeCellsAlongCellSegment,
  getLifeCellsAlongWorldSegment,
} from "@/lib/game-of-life/game-of-life-editing";

describe("getLifeCellCoordinatesFromWorldPoint", () => {
  it("maps world coordinates to the nearest visible cell", () => {
    expect(getLifeCellCoordinatesFromWorldPoint(0.49, -0.49)).toEqual({
      x: 0,
      y: 0,
    });
    expect(getLifeCellCoordinatesFromWorldPoint(0.51, -0.51)).toEqual({
      x: 1,
      y: -1,
    });
  });
});

describe("getLifeCellsAlongCellSegment", () => {
  it("includes every traversed cell across a horizontal drag", () => {
    expect(
      getLifeCellsAlongCellSegment({ x: -1, y: 2 }, { x: 2, y: 2 }),
    ).toEqual([
      { x: -1, y: 2 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
  });

  it("includes every traversed cell across a diagonal drag", () => {
    expect(
      getLifeCellsAlongCellSegment({ x: 0, y: 0 }, { x: 3, y: 2 }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 2 },
    ]);
  });
});

describe("getLifeCellsAlongWorldSegment", () => {
  it("converts world coordinates before tracing the drag path", () => {
    expect(getLifeCellsAlongWorldSegment(-0.4, -0.2, 2.2, 1.8)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });
});
