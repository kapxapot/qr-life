import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainView } from "@/components/main-view";

vi.mock("@/components/game-of-life/game-of-life-session", () => ({
  GameOfLifeSession: ({
    mode,
    onSwitchToPlayground,
    qrValue,
  }: {
    mode?: "playground" | "qr";
    onSwitchToPlayground: () => void;
    qrValue: string | null;
  }) => (
    <div>
      <output data-testid="game-mode">{mode}</output>
      <output data-testid="game-qr-value">{qrValue ?? ""}</output>
      <button type="button" onClick={onSwitchToPlayground}>
        Switch to Playground
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(window.history.state, "", "/");
});

describe("MainView", () => {
  it("clears the shared QR params when a QR session switches to Playground", async () => {
    window.history.replaceState(window.history.state, "", "/?v=hello");

    render(<MainView />);

    await waitFor(() => {
      expect(screen.getByTestId("game-mode").textContent).toBe("qr");
    });

    expect(screen.getByTestId("game-qr-value").textContent).toBe("hello");

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Playground" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("game-mode").textContent).toBe("playground");
      expect(screen.getByTestId("game-qr-value").textContent).toBe("");
      expect(window.location.search).toBe("");
    });
  });
});
