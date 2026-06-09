import { describe, expect, it } from "vitest";
import {
  getRequiredViewportBaseSpanForBounds,
  getViewportCenterForBounds,
} from "../lib/game-of-life-viewport";

describe("getRequiredViewportBaseSpanForBounds", () => {
  it("sizes the autofit span from the live bounds instead of the current center", () => {
    expect(
      getRequiredViewportBaseSpanForBounds(
        {
          maxX: 110,
          maxY: 10,
          minX: 0,
          minY: -10,
        },
        200,
        100,
        41,
      ),
    ).toBe(56);
  });
});

describe("getViewportCenterForBounds", () => {
  it("shifts only as much as needed when one side starts to overflow", () => {
    expect(
      getViewportCenterForBounds(
        { x: 0, y: 0 },
        {
          maxX: 25,
          maxY: 10,
          minX: -5,
          minY: -10,
        },
        41,
        41,
      ),
    ).toEqual({ x: 5, y: 0 });
  });

  it("keeps the current center when a larger span already fits symmetrically", () => {
    expect(
      getViewportCenterForBounds(
        { x: 50.5, y: 0 },
        {
          maxX: 110,
          maxY: 10,
          minX: 0,
          minY: -10,
        },
        220,
        41,
      ),
    ).toEqual({ x: 50.5, y: 0 });
  });

  it("balances the crop instead of pinning an edge when the next span still cannot fit", () => {
    expect(
      getViewportCenterForBounds(
        { x: 50.5, y: 0 },
        {
          maxX: 110,
          maxY: 10,
          minX: 0,
          minY: -10,
        },
        102,
        41,
      ),
    ).toEqual({ x: 55, y: 0 });
  });
});
