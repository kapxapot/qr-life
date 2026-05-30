export type LifeGrid = boolean[][];

export function countPopulation(grid: LifeGrid): number {
  let total = 0;

  for (const row of grid) {
    for (const cell of row) {
      if (cell) {
        total += 1;
      }
    }
  }

  return total;
}

export function nextGeneration(grid: LifeGrid): LifeGrid {
  const rowCount = grid.length;
  const columnCount = grid[0]?.length ?? 0;

  return Array.from({ length: rowCount }, (_, rowIndex) =>
    Array.from({ length: columnCount }, (_, columnIndex) => {
      let neighbors = 0;

      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (rowOffset === 0 && columnOffset === 0) {
            continue;
          }

          const nextRow = rowIndex + rowOffset;
          const nextColumn = columnIndex + columnOffset;

          if (
            nextRow >= 0 &&
            nextRow < rowCount &&
            nextColumn >= 0 &&
            nextColumn < columnCount &&
            grid[nextRow]?.[nextColumn]
          ) {
            neighbors += 1;
          }
        }
      }

      if (grid[rowIndex]?.[columnIndex]) {
        return neighbors === 2 || neighbors === 3;
      }

      return neighbors === 3;
    }),
  );
}
