import { describe, expect, it } from "vitest";
import {
  getBoundsCenter,
  getExpandedBounds,
  getRequiredViewportBaseSpanForBounds,
  getViewportCenterForBounds,
} from "../lib/game-of-life/game-of-life-viewport";

describe("getExpandedBounds", () => {
  it("grows the tracked autofit envelope without letting it shrink", () => {
    expect(
      getExpandedBounds(
        {
          maxX: 20,
          maxY: 8,
          minX: -22,
          minY: -9,
        },
        {
          maxX: 19,
          maxY: 7,
          minX: -21,
          minY: -8,
        },
      ),
    ).toEqual({
      maxX: 20,
      maxY: 8,
      minX: -22,
      minY: -9,
    });
  });
});

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

describe("getBoundsCenter", () => {
  it("returns the midpoint of the tracked bounds for fit recentering", () => {
    expect(
      getBoundsCenter({
        maxX: 110,
        maxY: 14,
        minX: 0,
        minY: -10,
      }),
    ).toEqual({ x: 55, y: 2 });
  });
});
