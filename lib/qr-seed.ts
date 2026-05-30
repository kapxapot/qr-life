import { countPopulation, type LifeGrid } from "@/lib/game-of-life";

const GRID_SIZE = 33;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function createSeedFromVideo(
  video: HTMLVideoElement,
  boundingBox: DOMRectReadOnly,
): LifeGrid {
  const side = Math.max(boundingBox.width, boundingBox.height) * 1.35;
  const centerX = boundingBox.x + boundingBox.width / 2;
  const centerY = boundingBox.y + boundingBox.height / 2;
  const sourceSize = Math.min(side, video.videoWidth, video.videoHeight);
  const sourceX = clamp(
    centerX - sourceSize / 2,
    0,
    video.videoWidth - sourceSize,
  );
  const sourceY = clamp(
    centerY - sourceSize / 2,
    0,
    video.videoHeight - sourceSize,
  );

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = GRID_SIZE;
  sampleCanvas.height = GRID_SIZE;

  const sampleContext = sampleCanvas.getContext("2d");

  if (!sampleContext) {
    throw new Error("Canvas sampling is unavailable in this browser.");
  }

  sampleContext.drawImage(
    video,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    GRID_SIZE,
    GRID_SIZE,
  );

  const { data } = sampleContext.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const luminances: number[] = [];
  let luminanceTotal = 0;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;

    luminances.push(luminance);
    luminanceTotal += luminance;
  }

  const averageLuminance = luminanceTotal / luminances.length;

  const buildGrid = (threshold: number) =>
    Array.from({ length: GRID_SIZE }, (_, rowIndex) =>
      Array.from({ length: GRID_SIZE }, (_, columnIndex) => {
        const sample = luminances[rowIndex * GRID_SIZE + columnIndex] ?? 255;
        return sample < threshold;
      }),
    );

  let threshold = averageLuminance * 0.94;
  let seed = buildGrid(threshold);
  let density = countPopulation(seed) / (GRID_SIZE * GRID_SIZE);

  if (density < 0.18) {
    threshold = averageLuminance * 1.08;
    seed = buildGrid(threshold);
    density = countPopulation(seed) / (GRID_SIZE * GRID_SIZE);
  }

  if (density > 0.62) {
    threshold = averageLuminance * 0.82;
    seed = buildGrid(threshold);
  }

  return seed;
}
