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
  it("opens value-only shared links from the canonical pathname", async () => {
    window.history.replaceState(window.history.state, "", "/hello");

    render(<MainView initialPathValue="hello" />);

    await waitFor(() => {
      expect(screen.getByTestId("game-mode").textContent).toBe("qr");
    });

    expect(screen.getByTestId("game-qr-value").textContent).toBe("hello");
  });

  it("canonicalizes legacy value-only share urls to the pathname", async () => {
    window.history.replaceState(window.history.state, "", "/?v=hello&debug=1");

    render(<MainView />);

    await waitFor(() => {
      expect(screen.getByTestId("game-mode").textContent).toBe("qr");
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/hello");
      expect(window.location.search).toBe("?debug=1");
    });
  });

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
      expect(window.location.pathname).toBe("/");
      expect(window.location.search).toBe("");
    });
  });
});
