"use client";

import type {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CopyFeedbackState,
  GameOfLifeActionBar,
  type ShareFeedbackState,
} from "@/components/game-of-life/game-of-life-action-bar";
import { GameOfLifeCanvasOverlay } from "@/components/game-of-life/game-of-life-canvas-overlay";
import {
  cloneUniverse,
  countPopulation,
  type FreeFlyingPatternCells,
  getAutofitUniverse,
  getFreeFlyingPatternCells,
  type LifeGrid,
  type LifeUniverse,
  nextGeneration,
  type UniverseBounds,
} from "@/lib/game-of-life/game-of-life";
import {
  AUTO_FIT_VIEWPORT_PADDING,
  AUTO_FIT_ZOOM_FACTOR,
  buildViewport,
  clampTickDelayMs,
  clampZoomFactor,
  cloneFreeFlyingPatternCells,
  createInitialGameViewState,
  DEFAULT_TICK_DELAY_MS,
  doesBoundsFitViewport,
  drawUniverse,
  getAutofitViewportCenter,
  getCanvasViewportMetrics,
  getClientPointWorldCoordinates,
  getPaddedUniverseBounds,
  getPinchGesture,
  getRequiredViewportBaseSpan,
  MAX_TICK_DELAY_MS,
  MIN_TICK_DELAY_MS,
  MIN_VIEWPORT_SPAN,
  type PinchGesture,
  type PointerCoordinates,
  RESIZE_REDRAW_DEBOUNCE_MS,
  TICK_DELAY_STORAGE_KEY,
  type ViewportCenter,
  WHEEL_ZOOM_SENSITIVITY,
  ZOOM_STEP,
} from "@/lib/game-of-life/game-of-life-canvas";
import {
  createLifeDebugSnapshot,
  type LifeDebugSnapshot,
} from "@/lib/game-of-life/game-of-life-debug";
import {
  getBoundsCenter,
  getExpandedBounds,
  getRequiredViewportBaseSpanForBounds,
} from "@/lib/game-of-life/game-of-life-viewport";

export type GameOfLifeSessionProps = {
  debug?: boolean;
  onReset: () => void;
  onScanAnother: () => void;
  qrValue: string | null;
  seed: LifeGrid;
};

type RedrawOptions = {
  patternCells?: FreeFlyingPatternCells;
  isAutoZoomEnabled?: boolean;
  universe?: LifeUniverse;
  viewportCenter?: ViewportCenter;
  zoomFactor?: number;
};

export function GameOfLifeSession({
  debug = false,
  onReset,
  onScanAnother,
  qrValue,
  seed,
}: GameOfLifeSessionProps) {
  const initialGameViewState = createInitialGameViewState(seed);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const shareFeedbackTimerRef = useRef<number | null>(null);
  const resizeDebounceTimerRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const initialGameViewStateRef = useRef(initialGameViewState);
  const largestViewportBaseSpanRef = useRef(
    initialGameViewState.viewportBaseSpan,
  );
  const autofitBoundsRef = useRef<UniverseBounds | null>(null);
  const viewportCenterRef = useRef<ViewportCenter>(
    initialGameViewState.viewportCenter,
  );
  const universeRef = useRef<LifeUniverse>(
    cloneUniverse(initialGameViewState.universe),
  );
  const patternCellsRef = useRef<FreeFlyingPatternCells>(
    cloneFreeFlyingPatternCells(initialGameViewState.patternCells),
  );
  const activePointersRef = useRef<Map<number, PointerCoordinates>>(new Map());
  const pinchGestureRef = useRef<PinchGesture | null>(null);

  const [universe, setUniverse] = useState<LifeUniverse>(() =>
    cloneUniverse(initialGameViewState.universe),
  );
  const [patternCells, setPatternCells] = useState<FreeFlyingPatternCells>(() =>
    cloneFreeFlyingPatternCells(initialGameViewState.patternCells),
  );
  const [generation, setGeneration] = useState(0);
  const [population, setPopulation] = useState(
    () => initialGameViewState.population,
  );
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedbackState>("idle");
  const [shareFeedback, setShareFeedback] =
    useState<ShareFeedbackState>("idle");
  const [hasStartedOnce, setHasStartedOnce] = useState(false);
  const [hasLoadedTickDelayPreference, setHasLoadedTickDelayPreference] =
    useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isAutoZoomEnabled, setIsAutoZoomEnabled] = useState(true);
  const [tickDelayMs, setTickDelayMs] = useState(DEFAULT_TICK_DELAY_MS);
  const [zoomFactor, setZoomFactor] = useState(AUTO_FIT_ZOOM_FACTOR);
  const isAutoZoomEnabledRef = useRef(isAutoZoomEnabled);
  const zoomFactorRef = useRef(zoomFactor);

  const stopSimulation = useCallback(() => {
    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }

    setIsRunning(false);
  }, []);

  const clearCopyFeedbackTimer = useCallback(() => {
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
  }, []);

  const clearShareFeedbackTimer = useCallback(() => {
    if (shareFeedbackTimerRef.current) {
      window.clearTimeout(shareFeedbackTimerRef.current);
      shareFeedbackTimerRef.current = null;
    }
  }, []);

  const redrawUniverse = useCallback(
    (options?: RedrawOptions) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const nextUniverse = options?.universe ?? universeRef.current;
      const nextPatternCells = options?.patternCells ?? patternCellsRef.current;
      const nextAutofitUniverse = getAutofitUniverse(
        nextUniverse,
        nextPatternCells.excludedCells,
      );
      const nextIsAutoZoomEnabled =
        options?.isAutoZoomEnabled ?? isAutoZoomEnabledRef.current;
      const nextZoomFactor = options?.zoomFactor ?? zoomFactorRef.current;
      let nextViewportCenter =
        options?.viewportCenter ?? viewportCenterRef.current;
      let nextViewportBaseSpan = largestViewportBaseSpanRef.current;
      const renderedCanvasWidth = Math.max(
        1,
        Math.floor(canvas.clientWidth || canvas.getBoundingClientRect().width),
      );
      const renderedCanvasHeight = Math.max(
        1,
        Math.floor(
          canvas.clientHeight || canvas.getBoundingClientRect().height,
        ),
      );
      const rawAutofitBounds = getPaddedUniverseBounds(
        nextAutofitUniverse,
        nextAutofitUniverse,
        AUTO_FIT_VIEWPORT_PADDING,
      );
      const nextAutofitBounds = nextIsAutoZoomEnabled
        ? getExpandedBounds(autofitBoundsRef.current, rawAutofitBounds)
        : rawAutofitBounds;
      const nextAutofitTargetSpan = nextAutofitBounds
        ? getRequiredViewportBaseSpanForBounds(
            nextAutofitBounds,
            renderedCanvasWidth,
            renderedCanvasHeight,
            MIN_VIEWPORT_SPAN,
          )
        : null;

      if (nextIsAutoZoomEnabled && nextAutofitBounds) {
        autofitBoundsRef.current = nextAutofitBounds;

        const currentViewport = buildViewport(
          nextViewportBaseSpan,
          nextViewportCenter,
          nextZoomFactor,
          renderedCanvasWidth,
          renderedCanvasHeight,
        );

        if (!doesBoundsFitViewport(nextAutofitBounds, currentViewport)) {
          if (
            nextAutofitTargetSpan !== null &&
            nextAutofitTargetSpan > nextViewportBaseSpan
          ) {
            nextViewportBaseSpan = Math.min(
              nextAutofitTargetSpan,
              nextViewportBaseSpan + 1,
            );
          }

          nextViewportCenter = getAutofitViewportCenter(
            currentViewport,
            nextAutofitBounds,
            nextViewportBaseSpan,
            nextZoomFactor,
            renderedCanvasWidth,
            renderedCanvasHeight,
          );

          largestViewportBaseSpanRef.current = nextViewportBaseSpan;
          viewportCenterRef.current = nextViewportCenter;
        }
      } else if (!nextIsAutoZoomEnabled) {
        autofitBoundsRef.current = null;
      }

      const nextDebugSnapshot = debug
        ? createLifeDebugSnapshot({
            autofitTargetSpan: nextAutofitTargetSpan,
            patternCells: nextPatternCells,
            universe: nextUniverse,
            viewportBaseSpan: nextViewportBaseSpan,
          })
        : null;

      drawUniverse(
        canvas,
        nextUniverse,
        nextPatternCells,
        nextDebugSnapshot,
        nextViewportBaseSpan,
        nextViewportCenter,
        nextZoomFactor,
      );
    },
    [debug],
  );

  const disableAutoZoom = useCallback(() => {
    if (!isAutoZoomEnabledRef.current) {
      return;
    }

    autofitBoundsRef.current = null;
    isAutoZoomEnabledRef.current = false;
    setIsAutoZoomEnabled(false);
  }, []);

  const commitManualViewport = useCallback(
    (
      nextViewportCenter: ViewportCenter,
      nextZoomFactor = zoomFactorRef.current,
    ) => {
      viewportCenterRef.current = nextViewportCenter;
      disableAutoZoom();

      if (zoomFactorRef.current !== nextZoomFactor) {
        zoomFactorRef.current = nextZoomFactor;
        setZoomFactor(nextZoomFactor);
      }

      redrawUniverse({
        isAutoZoomEnabled: false,
        viewportCenter: nextViewportCenter,
        zoomFactor: nextZoomFactor,
      });
    },
    [disableAutoZoom, redrawUniverse],
  );

  const panViewportByPixels = useCallback(
    (deltaX: number, deltaY: number) => {
      const canvas = canvasRef.current;

      if (!canvas || (deltaX === 0 && deltaY === 0)) {
        return;
      }

      const { displayCellSize } = getCanvasViewportMetrics(
        canvas,
        largestViewportBaseSpanRef.current,
        viewportCenterRef.current,
        zoomFactorRef.current,
      );

      const nextViewportCenter = {
        x: viewportCenterRef.current.x - deltaX / displayCellSize,
        y: viewportCenterRef.current.y - deltaY / displayCellSize,
      };

      commitManualViewport(nextViewportCenter);
    },
    [commitManualViewport],
  );

  const zoomViewportAtClientPoint = useCallback(
    (clientX: number, clientY: number, zoomMultiplier: number) => {
      const canvas = canvasRef.current;

      if (!canvas || !Number.isFinite(zoomMultiplier) || zoomMultiplier <= 0) {
        return;
      }

      const currentCanvasMetrics = getCanvasViewportMetrics(
        canvas,
        largestViewportBaseSpanRef.current,
        viewportCenterRef.current,
        zoomFactorRef.current,
      );
      const { worldX, worldY } = getClientPointWorldCoordinates(
        currentCanvasMetrics,
        clientX,
        clientY,
      );
      const nextZoomFactor = clampZoomFactor(
        zoomFactorRef.current * zoomMultiplier,
      );

      if (nextZoomFactor === zoomFactorRef.current) {
        return;
      }

      const nextViewport = buildViewport(
        largestViewportBaseSpanRef.current,
        viewportCenterRef.current,
        nextZoomFactor,
        currentCanvasMetrics.renderedCanvasWidth,
        currentCanvasMetrics.renderedCanvasHeight,
      );
      const nextDisplayCellSize = Math.min(
        currentCanvasMetrics.renderedCanvasWidth / nextViewport.spanX,
        currentCanvasMetrics.renderedCanvasHeight / nextViewport.spanY,
      );
      const localX = clientX - currentCanvasMetrics.canvasRect.left;
      const localY = clientY - currentCanvasMetrics.canvasRect.top;
      const nextViewportCenter = {
        x:
          worldX -
          (localX - currentCanvasMetrics.renderedCanvasWidth / 2) /
            nextDisplayCellSize,
        y:
          worldY -
          (localY - currentCanvasMetrics.renderedCanvasHeight / 2) /
            nextDisplayCellSize,
      };

      commitManualViewport(nextViewportCenter, nextZoomFactor);
    },
    [commitManualViewport],
  );

  const restoreInitialGameView = useCallback(
    (nextInitialGameViewState = initialGameViewStateRef.current) => {
      const nextUniverse = cloneUniverse(nextInitialGameViewState.universe);

      activePointersRef.current.clear();
      pinchGestureRef.current = null;
      autofitBoundsRef.current = null;
      largestViewportBaseSpanRef.current =
        nextInitialGameViewState.viewportBaseSpan;
      viewportCenterRef.current = nextInitialGameViewState.viewportCenter;
      universeRef.current = nextUniverse;
      patternCellsRef.current = cloneFreeFlyingPatternCells(
        nextInitialGameViewState.patternCells,
      );
      setUniverse(nextUniverse);
      setPatternCells(
        cloneFreeFlyingPatternCells(nextInitialGameViewState.patternCells),
      );
      setIsAutoZoomEnabled(true);
      isAutoZoomEnabledRef.current = true;
      setZoomFactor(AUTO_FIT_ZOOM_FACTOR);
      zoomFactorRef.current = AUTO_FIT_ZOOM_FACTOR;
      setGeneration(0);
      setHasStartedOnce(false);
      setPopulation(nextInitialGameViewState.population);

      redrawUniverse({
        isAutoZoomEnabled: true,
        universe: nextUniverse,
        viewportCenter: nextInitialGameViewState.viewportCenter,
        zoomFactor: AUTO_FIT_ZOOM_FACTOR,
      });
    },
    [redrawUniverse],
  );

  const advanceLife = useCallback(() => {
    const nextUniverse = nextGeneration(universeRef.current);
    const nextPatternCells = getFreeFlyingPatternCells(nextUniverse);
    const nextPopulation = countPopulation(nextUniverse);

    universeRef.current = nextUniverse;
    patternCellsRef.current = nextPatternCells;
    setUniverse(nextUniverse);
    setPatternCells(nextPatternCells);
    setGeneration((value) => value + 1);
    setPopulation(nextPopulation);

    if (nextPopulation === 0) {
      stopSimulation();
      setHasStartedOnce(false);
    }
  }, [stopSimulation]);

  const handleStart = useCallback(() => {
    setIsRunning((current) => {
      const nextRunningState = !current;

      if (nextRunningState) {
        setHasStartedOnce(true);
      }

      return nextRunningState;
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();

    zoomViewportAtClientPoint(
      canvasRect.left + canvasRect.width / 2,
      canvasRect.top + canvasRect.height / 2,
      ZOOM_STEP,
    );
  }, [zoomViewportAtClientPoint]);

  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();

    zoomViewportAtClientPoint(
      canvasRect.left + canvasRect.width / 2,
      canvasRect.top + canvasRect.height / 2,
      1 / ZOOM_STEP,
    );
  }, [zoomViewportAtClientPoint]);

  const handleFit = useCallback(() => {
    const canvas = canvasRef.current;
    const nextAutofitUniverse = getAutofitUniverse(
      universeRef.current,
      patternCellsRef.current.excludedCells,
    );
    let nextViewportCenter = initialGameViewStateRef.current.viewportCenter;
    let nextViewportBaseSpan = initialGameViewStateRef.current.viewportBaseSpan;

    if (canvas) {
      const renderedCanvasWidth = Math.max(
        1,
        Math.floor(canvas.clientWidth || canvas.getBoundingClientRect().width),
      );
      const renderedCanvasHeight = Math.max(
        1,
        Math.floor(
          canvas.clientHeight || canvas.getBoundingClientRect().height,
        ),
      );
      const nextAutofitBounds = getPaddedUniverseBounds(
        nextAutofitUniverse,
        nextAutofitUniverse,
        AUTO_FIT_VIEWPORT_PADDING,
      );

      if (nextAutofitBounds) {
        autofitBoundsRef.current = nextAutofitBounds;
        nextViewportBaseSpan = getRequiredViewportBaseSpanForBounds(
          nextAutofitBounds,
          renderedCanvasWidth,
          renderedCanvasHeight,
          MIN_VIEWPORT_SPAN,
        );
        nextViewportCenter = getBoundsCenter(nextAutofitBounds);
      } else {
        autofitBoundsRef.current = null;
      }
    }

    activePointersRef.current.clear();
    pinchGestureRef.current = null;
    viewportCenterRef.current = nextViewportCenter;
    largestViewportBaseSpanRef.current = nextViewportBaseSpan;
    setZoomFactor(AUTO_FIT_ZOOM_FACTOR);
    setIsAutoZoomEnabled(true);
    zoomFactorRef.current = AUTO_FIT_ZOOM_FACTOR;
    isAutoZoomEnabledRef.current = true;

    redrawUniverse({
      isAutoZoomEnabled: true,
      viewportCenter: nextViewportCenter,
      zoomFactor: AUTO_FIT_ZOOM_FACTOR,
    });
  }, [redrawUniverse]);

  const handleCanvasWheel = useCallback(
    (event: ReactWheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();

      const zoomMultiplier = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);

      zoomViewportAtClientPoint(event.clientX, event.clientY, zoomMultiplier);
    },
    [zoomViewportAtClientPoint],
  );

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      activePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      pinchGestureRef.current = getPinchGesture(activePointersRef.current);
    },
    [],
  );

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const previousPointer = activePointersRef.current.get(event.pointerId);

      if (!previousPointer) {
        return;
      }

      activePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });

      if (activePointersRef.current.size >= 2) {
        const nextPinchGesture = getPinchGesture(activePointersRef.current);

        if (!nextPinchGesture) {
          pinchGestureRef.current = null;
          return;
        }

        const previousPinchGesture = pinchGestureRef.current;
        pinchGestureRef.current = nextPinchGesture;

        if (!previousPinchGesture) {
          return;
        }

        const deltaX = nextPinchGesture.centerX - previousPinchGesture.centerX;
        const deltaY = nextPinchGesture.centerY - previousPinchGesture.centerY;

        if (deltaX !== 0 || deltaY !== 0) {
          panViewportByPixels(deltaX, deltaY);
        }

        if (
          previousPinchGesture.distance > 0 &&
          nextPinchGesture.distance > 0 &&
          nextPinchGesture.distance !== previousPinchGesture.distance
        ) {
          zoomViewportAtClientPoint(
            nextPinchGesture.centerX,
            nextPinchGesture.centerY,
            nextPinchGesture.distance / previousPinchGesture.distance,
          );
        }

        return;
      }

      pinchGestureRef.current = null;
      panViewportByPixels(
        event.clientX - previousPointer.clientX,
        event.clientY - previousPointer.clientY,
      );
    },
    [panViewportByPixels, zoomViewportAtClientPoint],
  );

  const handleCanvasPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      activePointersRef.current.delete(event.pointerId);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      pinchGestureRef.current = getPinchGesture(activePointersRef.current);
    },
    [],
  );

  const handleSpeedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextSliderValue = Number(event.target.value);
      const nextTickDelayMs = clampTickDelayMs(
        MAX_TICK_DELAY_MS + MIN_TICK_DELAY_MS - nextSliderValue,
      );

      setTickDelayMs(nextTickDelayMs);
    },
    [],
  );

  const handleCopyQrValue = useCallback(async () => {
    if (!qrValue) {
      return;
    }

    clearCopyFeedbackTimer();

    try {
      await navigator.clipboard.writeText(qrValue);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("failed");
    }

    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback("idle");
      copyFeedbackTimerRef.current = null;
    }, 1800);
  }, [clearCopyFeedbackTimer, qrValue]);

  const handleShareCurrentUrl = useCallback(async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    clearShareFeedbackTimer();

    try {
      const currentUrl = window.location.href;

      if (typeof navigator.share === "function") {
        await navigator.share({ url: currentUrl });
        setShareFeedback("shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentUrl);
        setShareFeedback("copied");
      } else {
        setShareFeedback("failed");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareFeedback("idle");
        return;
      }

      setShareFeedback("failed");
    }

    shareFeedbackTimerRef.current = window.setTimeout(() => {
      setShareFeedback("idle");
      shareFeedbackTimerRef.current = null;
    }, 1800);
  }, [clearShareFeedbackTimer]);

  useEffect(() => {
    let nextTickDelayMs = DEFAULT_TICK_DELAY_MS;

    try {
      const storedTickDelayMs = window.localStorage.getItem(
        TICK_DELAY_STORAGE_KEY,
      );

      if (storedTickDelayMs !== null) {
        const parsedTickDelayMs = Number(storedTickDelayMs);

        if (Number.isFinite(parsedTickDelayMs)) {
          nextTickDelayMs = clampTickDelayMs(parsedTickDelayMs);
        }
      }
    } catch {}

    setTickDelayMs(nextTickDelayMs);
    setHasLoadedTickDelayPreference(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedTickDelayPreference) {
      return;
    }

    try {
      window.localStorage.setItem(
        TICK_DELAY_STORAGE_KEY,
        String(clampTickDelayMs(tickDelayMs)),
      );
    } catch {}
  }, [hasLoadedTickDelayPreference, tickDelayMs]);

  useEffect(() => {
    isAutoZoomEnabledRef.current = isAutoZoomEnabled;
  }, [isAutoZoomEnabled]);

  useEffect(() => {
    zoomFactorRef.current = zoomFactor;
  }, [zoomFactor]);

  useEffect(() => {
    stopSimulation();
    clearCopyFeedbackTimer();
    clearShareFeedbackTimer();
    const nextInitialGameViewState = createInitialGameViewState(seed);

    initialGameViewStateRef.current = nextInitialGameViewState;
    setCopyFeedback("idle");
    setShareFeedback("idle");
    restoreInitialGameView(nextInitialGameViewState);
  }, [
    clearCopyFeedbackTimer,
    clearShareFeedbackTimer,
    restoreInitialGameView,
    seed,
    stopSimulation,
  ]);

  useEffect(() => {
    redrawUniverse({
      patternCells,
      isAutoZoomEnabled,
      universe,
      zoomFactor,
    });
  }, [isAutoZoomEnabled, patternCells, redrawUniverse, universe, zoomFactor]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || typeof ResizeObserver === "undefined") {
      return;
    }

    const scheduleRedraw = () => {
      if (resizeDebounceTimerRef.current !== null) {
        window.clearTimeout(resizeDebounceTimerRef.current);
      }

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }

      resizeDebounceTimerRef.current = window.setTimeout(() => {
        resizeDebounceTimerRef.current = null;
        resizeFrameRef.current = window.requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          redrawUniverse();
        });
      }, RESIZE_REDRAW_DEBOUNCE_MS);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleRedraw();
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();

      if (resizeDebounceTimerRef.current !== null) {
        window.clearTimeout(resizeDebounceTimerRef.current);
        resizeDebounceTimerRef.current = null;
      }

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [redrawUniverse]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    simulationTimerRef.current = window.setInterval(advanceLife, tickDelayMs);

    return () => {
      if (simulationTimerRef.current) {
        window.clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [advanceLife, isRunning, tickDelayMs]);

  useEffect(() => {
    return () => {
      activePointersRef.current.clear();
      pinchGestureRef.current = null;
      clearCopyFeedbackTimer();
      clearShareFeedbackTimer();
      stopSimulation();
    };
  }, [clearCopyFeedbackTimer, clearShareFeedbackTimer, stopSimulation]);

  const speedSliderValue = MAX_TICK_DELAY_MS + MIN_TICK_DELAY_MS - tickDelayMs;
  const canShareCurrentUrl =
    typeof navigator !== "undefined" &&
    (typeof navigator.share === "function" ||
      typeof navigator.clipboard?.writeText === "function");
  const startButtonLabel = isRunning
    ? "Pause"
    : hasStartedOnce
      ? "Resume"
      : "Start";
  const currentAutofitUniverse = getAutofitUniverse(
    universe,
    patternCells.excludedCells,
  );
  const debugCanvas = canvasRef.current;
  const currentAutofitTargetSpan =
    debugCanvas && currentAutofitUniverse.size > 0
      ? getRequiredViewportBaseSpan(
          currentAutofitUniverse,
          currentAutofitUniverse,
          AUTO_FIT_VIEWPORT_PADDING,
          Math.max(
            1,
            Math.floor(
              debugCanvas.clientWidth ||
                debugCanvas.getBoundingClientRect().width,
            ),
          ),
          Math.max(
            1,
            Math.floor(
              debugCanvas.clientHeight ||
                debugCanvas.getBoundingClientRect().height,
            ),
          ),
        )
      : null;
  const currentDebugSnapshot: LifeDebugSnapshot | null = debug
    ? createLifeDebugSnapshot({
        autofitTargetSpan: currentAutofitTargetSpan,
        patternCells,
        universe,
        viewportBaseSpan: largestViewportBaseSpanRef.current,
      })
    : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-[#020617]">
        <div className="flex min-h-0 flex-1 flex-col gap-3 pb-3 sm:gap-4 sm:pb-4">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden border-b border-cyan-300/14 bg-[#020617] p-1">
            <div className="relative h-full w-full">
              <canvas
                ref={canvasRef}
                onPointerCancel={handleCanvasPointerUp}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onWheel={handleCanvasWheel}
                className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
              />

              <GameOfLifeCanvasOverlay
                debugSnapshot={currentDebugSnapshot}
                generation={generation}
                isAutoZoomEnabled={isAutoZoomEnabled}
                onFit={handleFit}
                onSpeedChange={handleSpeedChange}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                population={population}
                speedSliderMax={MAX_TICK_DELAY_MS}
                speedSliderMin={MIN_TICK_DELAY_MS}
                speedSliderStep={20}
                speedSliderValue={speedSliderValue}
              />
            </div>
          </div>

          <GameOfLifeActionBar
            canShareCurrentUrl={canShareCurrentUrl}
            copyFeedback={copyFeedback}
            onCopyQrValue={handleCopyQrValue}
            onReset={onReset}
            onScanAnother={onScanAnother}
            onShareCurrentUrl={handleShareCurrentUrl}
            onStart={handleStart}
            qrValue={qrValue}
            shareFeedback={shareFeedback}
            startButtonLabel={startButtonLabel}
          />
        </div>
      </div>
    </div>
  );
}
