import type { CSSProperties } from "react";

const qrPattern = [
  "111111100010011111111",
  "100000101101010000001",
  "101110100111010111101",
  "101110101010010111101",
  "101110100001010111101",
  "100000101110010000001",
  "111111101010111111111",
  "000000000111000000000",
  "011010111001111010110",
  "100111001111000111001",
  "011001110010111001010",
  "110110001101101110011",
  "001011111000110010100",
  "000000001011001101000",
  "111111101101110010111",
  "100000101010011100001",
  "101110101111010111001",
  "101110100010110101110",
  "101110101100001110011",
  "100000101011100101001",
  "111111100110011111111",
] as const;

const lifePattern = [
  "0000011000000000",
  "0000100100000000",
  "0001000010000000",
  "0010000001000000",
  "0110001111110000",
  "1001011000011000",
  "0110011001110100",
  "0001110000101110",
  "0010011111000100",
  "0100000100111000",
  "0111001110000000",
  "0000100011000000",
  "0000011100100000",
  "0000000110010000",
  "0000000001111000",
  "0000000000011000",
] as const;

const stages = [
  {
    id: "01",
    title: "Scan",
    description:
      "Frame the QR and freeze its black-and-white matrix as a seed.",
  },
  {
    id: "02",
    title: "Seed",
    description:
      "Translate each dark square into a live cell on the Conway grid.",
  },
  {
    id: "03",
    title: "Evolve",
    description: "Watch the pattern bloom into motion, symmetry, and surprise.",
  },
] as const;

type MatrixBoardProps = {
  cells: readonly string[];
  variant: "life" | "qr";
};

type MatrixCell = {
  delay: string;
  isActive: boolean;
  key: string;
};

function createMatrixCells(
  cells: readonly string[],
  variant: MatrixBoardProps["variant"],
): MatrixCell[] {
  const matrixCells: MatrixCell[] = [];

  for (const [rowNumber, row] of cells.entries()) {
    for (const [columnNumber, rawCell] of Array.from(row).entries()) {
      matrixCells.push({
        delay: `${(rowNumber * row.length + columnNumber) * 45}ms`,
        isActive: rawCell === "1",
        key: `${variant}-${rowNumber + 1}-${columnNumber + 1}`,
      });
    }
  }

  return matrixCells;
}

function MatrixBoard({ cells, variant }: MatrixBoardProps) {
  const columns = cells[0]?.length ?? 1;
  const boardStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  };
  const matrixCells = createMatrixCells(cells, variant);

  return (
    <div className="grid gap-1" style={boardStyle}>
      {matrixCells.map(({ delay, isActive, key }) => (
        <span
          key={key}
          className={[
            "aspect-square rounded-[4px] transition-transform duration-300",
            variant === "qr"
              ? isActive
                ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                : "bg-slate-900/80"
              : isActive
                ? "animate-pulse bg-gradient-to-br from-cyan-300 via-emerald-300 to-fuchsia-400 shadow-[0_0_18px_rgba(74,222,128,0.42)] [animation-duration:2.8s]"
                : "border border-white/5 bg-[#09101f]",
          ].join(" ")}
          style={
            variant === "life" && isActive
              ? { animationDelay: delay }
              : undefined
          }
        />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(217,70,239,0.18),_transparent_26%),radial-gradient(circle_at_80%_80%,_rgba(249,115,22,0.18),_transparent_22%),linear-gradient(180deg,_#050816_0%,_#070c19_48%,_#04050d_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]" />
      <div className="absolute left-[6%] top-20 -z-10 h-44 w-44 animate-pulse rounded-full bg-cyan-400/18 blur-3xl [animation-delay:120ms] [animation-duration:10s]" />
      <div className="absolute right-[10%] top-[18%] -z-10 h-52 w-52 animate-pulse rounded-full bg-fuchsia-500/16 blur-3xl [animation-delay:1.4s] [animation-duration:13s]" />
      <div className="absolute bottom-[8%] left-[44%] -z-10 h-40 w-40 animate-pulse rounded-full bg-amber-400/14 blur-3xl [animation-delay:2.2s] [animation-duration:9s]" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 py-10 sm:px-8 lg:px-12">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-cyan-100/90">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" />
              QR Life Prototype
            </div>

            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Scan a QR code to{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-emerald-300 to-fuchsia-400 bg-clip-text text-transparent">
                bring it to life
              </span>
              .
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
              Start with a familiar code, turn every dark module into a living
              Conway cell, and let the pattern unfold into a bright, reactive
              universe.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-cyan-200/20 bg-gradient-to-r from-cyan-400 via-emerald-300 to-fuchsia-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_-16px_rgba(34,211,238,0.65)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                Scan a QR
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 backdrop-blur transition-colors duration-200 hover:bg-white/10"
              >
                Preview the evolution
              </button>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {stages.map((stage) => (
                <article
                  key={stage.id}
                  className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-xl"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                    {stage.id}
                  </p>
                  <h2 className="mt-3 text-lg font-semibold text-white">
                    {stage.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {stage.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="relative mx-auto w-full max-w-[480px]">
            <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-[0_42px_120px_-32px_rgba(56,189,248,0.38)] backdrop-blur-2xl">
              <div className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,19,37,0.98),rgba(5,8,17,0.98))] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
                      Bring It To Life
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      Scan your starting pattern
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
                    Camera Ready
                  </div>
                </div>

                <div className="relative mt-5 overflow-hidden rounded-[1.5rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_top,_rgba(8,47,73,0.36),transparent_48%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] px-5 py-6">
                  <div className="absolute inset-4 rounded-[1.1rem] border border-dashed border-cyan-200/18" />
                  <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[18%] -translate-y-1/2 animate-pulse rounded-full bg-cyan-400/20 blur-[10px] [animation-duration:2.8s]" />
                  <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-px -translate-y-1/2 animate-pulse bg-gradient-to-r from-transparent via-cyan-200 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.95)] [animation-duration:1.8s]" />
                  <div className="absolute left-7 top-7 h-9 w-9 rounded-tl-2xl border-l-2 border-t-2 border-cyan-300/70" />
                  <div className="absolute right-7 top-7 h-9 w-9 rounded-tr-2xl border-r-2 border-t-2 border-cyan-300/70" />
                  <div className="absolute bottom-7 left-7 h-9 w-9 rounded-bl-2xl border-b-2 border-l-2 border-cyan-300/70" />
                  <div className="absolute bottom-7 right-7 h-9 w-9 rounded-br-2xl border-b-2 border-r-2 border-cyan-300/70" />

                  <div className="relative mx-auto w-fit rounded-[1.35rem] border border-white/12 bg-white/5 p-3 shadow-[0_18px_50px_-28px_rgba(255,255,255,0.25)] backdrop-blur">
                    <div className="rounded-[1rem] bg-white p-3">
                      <MatrixBoard cells={qrPattern} variant="qr" />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-slate-400">
                    <span>Frame the QR</span>
                    <span>Tap to capture</span>
                  </div>
                </div>

                <div className="my-5 flex items-center gap-3 text-sm text-slate-300">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.2em] text-cyan-100/80">
                    mapped into life
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-300/60 to-transparent" />
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,34,0.95),rgba(5,10,20,0.95))] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
                        Generation 0001
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        Living grid preview
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      Conway Engine
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.2rem] border border-cyan-300/12 bg-[#030712]/90 p-4">
                    <MatrixBoard cells={lifePattern} variant="life" />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-slate-400">Live cells</p>
                      <p className="mt-1 font-mono text-lg text-cyan-200">
                        256
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-slate-400">Birth rule</p>
                      <p className="mt-1 font-mono text-lg text-emerald-200">
                        B3
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-slate-400">Survival</p>
                      <p className="mt-1 font-mono text-lg text-fuchsia-200">
                        S23
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
