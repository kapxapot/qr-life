import { describe, expect, it } from "vitest";
import type { LifeGrid } from "../lib/game-of-life/game-of-life";
import { jsQr } from "../lib/qr/jsqr";
import { createQrSeedFromText } from "../lib/qr/qr-generator";

const MODULE_SIZE = 8;
const QUIET_ZONE_SIZE = 4;

function renderSeedToImageData(seed: LifeGrid) {
  const qrSize = seed.length + QUIET_ZONE_SIZE * 2;
  const width = qrSize * MODULE_SIZE;
  const height = qrSize * MODULE_SIZE;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
    data[pixelIndex] = 255;
    data[pixelIndex + 1] = 255;
    data[pixelIndex + 2] = 255;
    data[pixelIndex + 3] = 255;
  }

  for (let rowIndex = 0; rowIndex < seed.length; rowIndex += 1) {
    for (
      let columnIndex = 0;
      columnIndex < seed[rowIndex].length;
      columnIndex += 1
    ) {
      if (!seed[rowIndex]?.[columnIndex]) {
        continue;
      }

      const pixelRowStart = (rowIndex + QUIET_ZONE_SIZE) * MODULE_SIZE;
      const pixelColumnStart = (columnIndex + QUIET_ZONE_SIZE) * MODULE_SIZE;

      for (
        let pixelRow = pixelRowStart;
        pixelRow < pixelRowStart + MODULE_SIZE;
        pixelRow += 1
      ) {
        for (
          let pixelColumn = pixelColumnStart;
          pixelColumn < pixelColumnStart + MODULE_SIZE;
          pixelColumn += 1
        ) {
          const pixelIndex = (pixelRow * width + pixelColumn) * 4;

          data[pixelIndex] = 0;
          data[pixelIndex + 1] = 0;
          data[pixelIndex + 2] = 0;
        }
      }
    }
  }

  return { data, height, width };
}

describe("createQrSeedFromText", () => {
  it.each([
    "Hello QR Life",
    "https://example.com/invite/hello-world?lang=en&theme=aurora",
    "QR Life says hello to Tbilisi",
  ])("creates a decodable QR for %s", (text) => {
    const seed = createQrSeedFromText(text);
    const imageData = renderSeedToImageData(seed);
    const decoded = jsQr(imageData.data, imageData.width, imageData.height);

    expect(decoded?.data).toBe(text);
    expect(seed.length).toBeGreaterThanOrEqual(21);
    expect((seed.length - 21) % 4).toBe(0);
  });

  it("supports utf-8 payloads", () => {
    const text = "\u041f\u0440\u0438\u0432\u0435\u0442, QR Life";
    const seed = createQrSeedFromText(text);
    const imageData = renderSeedToImageData(seed);
    const decoded = jsQr(imageData.data, imageData.width, imageData.height);

    expect(decoded?.data).toBe(text);
  });

  it("uses larger QR versions for longer text", () => {
    const text = "qr-life-".repeat(36);
    const seed = createQrSeedFromText(text);

    expect(seed.length).toBeGreaterThan(21);
  });
});
