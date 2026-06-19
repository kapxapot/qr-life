"use client";

import { useState } from "react";
import {
  GameOfLifeSession,
  type GameOfLifeSessionProps,
} from "@/components/game-of-life-session";

type Props = Omit<GameOfLifeSessionProps, "onReset">;

export function GameOfLife({
  debug = false,
  onScanAnother,
  qrValue,
  seed,
}: Props) {
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <GameOfLifeSession
      debug={debug}
      key={sessionKey}
      onReset={() => {
        setSessionKey((current) => current + 1);
      }}
      onScanAnother={onScanAnother}
      qrValue={qrValue}
      seed={seed}
    />
  );
}
