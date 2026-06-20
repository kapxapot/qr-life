import type { LifeGrid } from "@/lib/game-of-life/game-of-life";

export const QR_SVG_QUIET_ZONE_SIZE = 2;

export function getQrSvgViewBoxSize(seed: LifeGrid) {
  return seed.length + QR_SVG_QUIET_ZONE_SIZE * 2;
}

export function getQrSvgPathData(seed: LifeGrid) {
  const commands: string[] = [];

  for (let rowIndex = 0; rowIndex < seed.length; rowIndex += 1) {
    for (
      let columnIndex = 0;
      columnIndex < seed[rowIndex].length;
      columnIndex += 1
    ) {
      if (!seed[rowIndex]?.[columnIndex]) {
        continue;
      }

      commands.push(
        `M${columnIndex + QR_SVG_QUIET_ZONE_SIZE} ${rowIndex + QR_SVG_QUIET_ZONE_SIZE}h1v1h-1z`,
      );
    }
  }

  return commands.join("");
}

export function createQrSvgMarkup(seed: LifeGrid) {
  const viewBoxSize = getQrSvgViewBoxSize(seed);
  const pathData = getQrSvgPathData(seed);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" shape-rendering="crispEdges">`,
    `<rect width="${viewBoxSize}" height="${viewBoxSize}" fill="white"/>`,
    pathData ? `<path d="${pathData}" fill="black"/>` : "",
    "</svg>",
  ].join("");
}

export function downloadQrSvg(seed: LifeGrid, filename = "qr-code.svg") {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return;
  }

  const svgMarkup = createQrSvgMarkup(seed);
  const blob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = objectUrl;
  downloadLink.download = filename;
  downloadLink.click();
  URL.revokeObjectURL(objectUrl);
}
