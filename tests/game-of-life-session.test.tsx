import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { GameOfLifeSession } from "../components/game-of-life/game-of-life-session";

const canvasContextStub = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  globalAlpha: 1,
  imageSmoothingEnabled: false,
  lineWidth: 1,
  restore: vi.fn(),
  save: vi.fn(),
  setTransform: vi.fn(),
  strokeRect: vi.fn(),
};

beforeAll(() => {
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: 1,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: "",
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => canvasContextStub),
  });
});

function configureCanvas(canvas: HTMLCanvasElement) {
  const capturedPointerIds = new Set<number>();

  Object.defineProperty(canvas, "clientHeight", {
    configurable: true,
    value: 170,
  });
  Object.defineProperty(canvas, "clientWidth", {
    configurable: true,
    value: 170,
  });
  Object.defineProperty(canvas, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 170,
      height: 170,
      left: 0,
      right: 170,
      top: 0,
      width: 170,
      x: 0,
      y: 0,
      toJSON: () => "",
    }),
  });

  canvas.hasPointerCapture = vi.fn((pointerId: number) =>
    capturedPointerIds.has(pointerId),
  );
  canvas.releasePointerCapture = vi.fn((pointerId: number) => {
    capturedPointerIds.delete(pointerId);
  });
  canvas.setPointerCapture = vi.fn((pointerId: number) => {
    capturedPointerIds.add(pointerId);
  });
}

describe("GameOfLifeSession", () => {
  it("starts on the first tap after a touch edit", async () => {
    const { container } = render(
      <GameOfLifeSession
        mode="playground"
        onReset={() => {}}
        onScanAnother={() => {}}
        qrValue={null}
        seed={[]}
      />,
    );
    const canvas = container.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas was not rendered.");
    }

    configureCanvas(canvas);

    const startButton = screen.getByRole("button", { name: "Start" });
    expect(startButton.getAttribute("disabled")).not.toBeNull();

    const pointerDownEvent = createEvent.pointerDown(canvas, {
      button: 0,
      cancelable: true,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "touch",
    });
    expect(fireEvent(canvas, pointerDownEvent)).toBe(false);
    expect(pointerDownEvent.defaultPrevented).toBe(true);

    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "touch",
    });

    await waitFor(() => {
      expect(startButton.getAttribute("disabled")).toBeNull();
    });

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    });
  });

  it("does not capture edit strokes while drawing", () => {
    const { container } = render(
      <GameOfLifeSession
        mode="playground"
        onReset={() => {}}
        onScanAnother={() => {}}
        qrValue={null}
        seed={[]}
      />,
    );
    const canvas = container.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas was not rendered.");
    }

    configureCanvas(canvas);

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(canvas.setPointerCapture).not.toHaveBeenCalled();
  });

  it("still captures touch gestures while panning", () => {
    const { container } = render(
      <GameOfLifeSession
        mode="qr"
        onReset={() => {}}
        onScanAnother={() => {}}
        qrValue="hello"
        seed={[[0, 0]]}
      />,
    );
    const canvas = container.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas was not rendered.");
    }

    configureCanvas(canvas);

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
  });
});
