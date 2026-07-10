import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  cleanup();
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

function getPopulationValue() {
  return screen.getByText("Cells").parentElement?.textContent ?? "";
}

describe("GameOfLifeSession", () => {
  it("starts on the first tap after a touch edit", async () => {
    const { container } = render(
      <GameOfLifeSession
        mode="playground"
        onScanAnother={() => {}}
        onSwitchToPlayground={() => {}}
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

    fireEvent.pointerDown(startButton, {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerUp(startButton, {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    });
  });

  it("ignores the synthetic click that can follow a touch pointerup", async () => {
    const { container } = render(
      <GameOfLifeSession
        mode="playground"
        onScanAnother={() => {}}
        onSwitchToPlayground={() => {}}
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

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "touch",
    });
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

    fireEvent.pointerDown(startButton, {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerUp(startButton, {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    });
  });

  it("does not capture edit strokes while still capturing panning gestures", () => {
    const { container } = render(
      <GameOfLifeSession
        mode="playground"
        onScanAnother={() => {}}
        onSwitchToPlayground={() => {}}
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
    cleanup();

    const { container: qrContainer } = render(
      <GameOfLifeSession
        mode="qr"
        onScanAnother={() => {}}
        onSwitchToPlayground={() => {}}
        qrValue="hello"
        seed={[[0, 0]]}
      />,
    );
    const qrCanvas = qrContainer.querySelector("canvas");

    if (!(qrCanvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas was not rendered.");
    }

    configureCanvas(qrCanvas);

    fireEvent.pointerDown(qrCanvas, {
      button: 0,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(qrCanvas.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it("shows Playground reset only after the first start and restores that state", async () => {
    const { container } = render(
      <GameOfLifeSession
        mode="playground"
        onScanAnother={() => {}}
        onSwitchToPlayground={() => {}}
        qrValue={null}
        seed={[]}
      />,
    );
    const canvas = container.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas was not rendered.");
    }

    configureCanvas(canvas);

    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "mouse",
    });

    const startButton = screen.getByRole("button", { name: "Start" });

    await waitFor(() => {
      expect(startButton.getAttribute("disabled")).toBeNull();
    });

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Start" }).getAttribute("disabled"),
    ).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Clear cells" })
        .getAttribute("disabled"),
    ).toBeNull();
  });

  it("forgets the saved Playground reset state after clearing the field", async () => {
    const { container } = render(
      <GameOfLifeSession
        mode="playground"
        onScanAnother={() => {}}
        onSwitchToPlayground={() => {}}
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
      pointerType: "mouse",
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "mouse",
    });

    const startButton = screen.getByRole("button", { name: "Start" });

    await waitFor(() => {
      expect(startButton.getAttribute("disabled")).toBeNull();
    });

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear cells" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    });

    expect(
      screen.getByRole("button", { name: "Start" }).getAttribute("disabled"),
    ).not.toBeNull();
  });

  it("replaces the saved Playground reset state after reset, edit, and start", async () => {
    const { container } = render(
      <GameOfLifeSession
        mode="playground"
        onScanAnother={() => {}}
        onSwitchToPlayground={() => {}}
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
      pointerType: "mouse",
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 85,
      clientY: 85,
      pointerId: 1,
      pointerType: "mouse",
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Start" }).getAttribute("disabled"),
      ).toBeNull();
      expect(getPopulationValue()).toContain("1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
      expect(getPopulationValue()).toContain("1");
    });

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 105,
      clientY: 85,
      pointerId: 2,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 105,
      clientY: 85,
      pointerId: 2,
      pointerType: "mouse",
    });

    await waitFor(() => {
      expect(getPopulationValue()).toContain("2");
    });

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
      expect(getPopulationValue()).toContain("2");
    });
  });
});
