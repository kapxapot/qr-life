import type { LifeGrid } from "@/lib/game-of-life/game-of-life";
import type { JsQrBitMatrix } from "@/lib/qr/jsqr";

export function createSeedFromQrMatrix(matrix: JsQrBitMatrix): LifeGrid {
  if (matrix.width <= 0 || matrix.height <= 0) {
    throw new Error("The extracted QR matrix is empty.");
  }

  if (matrix.width !== matrix.height) {
    throw new Error("The extracted QR matrix must be square.");
  }

  const dimension = matrix.width;

  return Array.from({ length: dimension }, (_, rowIndex) =>
    Array.from({ length: dimension }, (_, columnIndex) =>
      matrix.get(columnIndex, rowIndex),
    ),
  );
}
