import type { Metadata } from "next";
import { MainView } from "@/components/main-view";

export const metadata: Metadata = {
  title: "QR Life",
  description:
    "Scan a QR code, turn it into a Conway's Game of Life seed, and bring it to life.",
};

export default function Home() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.2),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.16),transparent_24%),radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.14),transparent_20%),linear-gradient(180deg,#040816_0%,#060b17_52%,#03050d_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[72px_72px] mask-[radial-gradient(circle_at_center,black,transparent_84%)]" />
      <div className="absolute left-[8%] top-16 -z-10 h-44 w-44 animate-pulse rounded-full bg-cyan-400/18 blur-3xl [animation-delay:160ms] animation-duration-[11s]" />
      <div className="absolute bottom-[10%] right-[12%] -z-10 h-52 w-52 animate-pulse rounded-full bg-fuchsia-500/16 blur-3xl [animation-delay:1.6s] animation-duration-[14s]" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-10 sm:px-8 lg:px-12">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-white sm:text-2xl lg:text-3xl">
            Scan a QR to{" "}
            <span className="bg-linear-to-r from-cyan-300 via-emerald-300 to-fuchsia-400 bg-clip-text text-transparent">
              bring it to life
            </span>
          </h1>
        </section>

        <div className="mt-10">
          <MainView />
        </div>
      </div>
    </main>
  );
}
