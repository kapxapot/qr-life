export type LifeCellCoordinates = {
  x: number;
  y: number;
};

function getLifeCellCoordinate(worldCoordinate: number) {
  return Math.floor(worldCoordinate + 0.5);
}

export function getLifeCellCoordinatesFromWorldPoint(
  worldX: number,
  worldY: number,
): LifeCellCoordinates {
  return {
    x: getLifeCellCoordinate(worldX),
    y: getLifeCellCoordinate(worldY),
  };
}

export function getLifeCellsAlongCellSegment(
  startCell: LifeCellCoordinates,
  endCell: LifeCellCoordinates,
): LifeCellCoordinates[] {
  const traversedCells: LifeCellCoordinates[] = [];
  const deltaX = Math.abs(endCell.x - startCell.x);
  const deltaY = Math.abs(endCell.y - startCell.y);
  const stepX = startCell.x <= endCell.x ? 1 : -1;
  const stepY = startCell.y <= endCell.y ? 1 : -1;
  let currentX = startCell.x;
  let currentY = startCell.y;
  let error = deltaX - deltaY;

  while (true) {
    traversedCells.push({ x: currentX, y: currentY });

    if (currentX === endCell.x && currentY === endCell.y) {
      return traversedCells;
    }

    const doubledError = error * 2;

    if (doubledError > -deltaY) {
      error -= deltaY;
      currentX += stepX;
    }

    if (doubledError < deltaX) {
      error += deltaX;
      currentY += stepY;
    }
  }
}

export function getLifeCellsAlongWorldSegment(
  startWorldX: number,
  startWorldY: number,
  endWorldX: number,
  endWorldY: number,
): LifeCellCoordinates[] {
  return getLifeCellsAlongCellSegment(
    getLifeCellCoordinatesFromWorldPoint(startWorldX, startWorldY),
    getLifeCellCoordinatesFromWorldPoint(endWorldX, endWorldY),
  );
}
