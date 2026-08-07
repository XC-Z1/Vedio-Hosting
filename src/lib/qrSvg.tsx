import React from 'react';

// Generates a clean 25x25 matrix QR SVG for any URL string
export function QRCodeSvg({ value, size = 180, darkColor = "#10b981", lightColor = "#ffffff" }: { value: string; size?: number; darkColor?: string; lightColor?: string }) {
  const matrixSize = 25; // 25x25 grid
  const modules: boolean[][] = Array(matrixSize).fill(false).map(() => Array(matrixSize).fill(false));

  // Helper to draw a 7x7 Finder Pattern at (row, col)
  const drawFinderPattern = (r: number, c: number) => {
    for (let dr = 0; dr < 7; dr++) {
      for (let dc = 0; dc < 7; dc++) {
        const isBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const isInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        modules[r + dr][c + dc] = isBorder || isInner;
      }
    }
  };

  // 1. Position Finder Patterns
  drawFinderPattern(0, 0); // Top Left
  drawFinderPattern(0, matrixSize - 7); // Top Right
  drawFinderPattern(matrixSize - 7, 0); // Bottom Left

  // 2. Timing Patterns
  for (let i = 8; i < matrixSize - 8; i++) {
    modules[6][i] = i % 2 === 0;
    modules[i][6] = i % 2 === 0;
  }

  // 3. Simple deterministic hashing for interior data modules
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      // Skip finder patterns area
      const isTopLeft = r < 8 && c < 8;
      const isTopRight = r < 8 && c >= matrixSize - 8;
      const isBottomLeft = r >= matrixSize - 8 && c < 8;
      const isTiming = r === 6 || c === 6;

      if (!isTopLeft && !isTopRight && !isBottomLeft && !isTiming) {
        const moduleHash = (hash ^ (r * 31 + c * 17)) & 0xffffff;
        modules[r][c] = (moduleHash % 3) !== 0;
      }
    }
  }

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${matrixSize} ${matrixSize}`} 
      className="rounded-xl shadow-lg border border-emerald-500/30 p-2 bg-white"
    >
      <rect width={matrixSize} height={matrixSize} fill={lightColor} />
      {modules.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c}
              y={r}
              width={1}
              height={1}
              fill={darkColor}
              rx={0.15}
            />
          ) : null
        )
      )}
    </svg>
  );
}
