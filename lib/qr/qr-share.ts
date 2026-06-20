import type { LifeGrid } from "@/lib/game-of-life/game-of-life";

const SHARE_FORMAT_VERSION = 1;
const QR_DIMENSION_MIN = 21;
const QR_DIMENSION_MAX = 177;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

function isSupportedQrDimension(dimension: number) {
  return (
    Number.isInteger(dimension) &&
    dimension >= QR_DIMENSION_MIN &&
    dimension <= QR_DIMENSION_MAX &&
    (dimension - QR_DIMENSION_MIN) % 4 === 0
  );
}

function ensureShareableSeed(seed: LifeGrid) {
  const dimension = seed.length;

  if (!isSupportedQrDimension(dimension)) {
    throw new Error("The QR grid has an unsupported size.");
  }

  for (const row of seed) {
    if (row.length !== dimension) {
      throw new Error("The QR grid must stay square to be shared.");
    }
  }

  return dimension;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string) {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new Error("The shared QR payload is empty.");
  }

  if (!BASE64_URL_PATTERN.test(normalizedValue)) {
    throw new Error("The shared QR payload contains invalid characters.");
  }

  const base64 = normalizedValue.replace(/-/gu, "+").replace(/_/gu, "/");
  const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    const binary = atob(paddedBase64);

    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("The shared QR payload could not be decoded.");
  }
}

export function encodeSharedQrSeed(seed: LifeGrid) {
  const dimension = ensureShareableSeed(seed);
  const totalCellCount = dimension * dimension;
  const bytes = new Uint8Array(2 + Math.ceil(totalCellCount / 8));

  bytes[0] = SHARE_FORMAT_VERSION;
  bytes[1] = dimension;

  let bitOffset = 0;

  for (const row of seed) {
    for (const cell of row) {
      if (cell) {
        const byteOffset = 2 + Math.floor(bitOffset / 8);
        const bitMask = 1 << (7 - (bitOffset % 8));

        bytes[byteOffset] |= bitMask;
      }

      bitOffset += 1;
    }
  }

  return toBase64Url(bytes);
}

export function decodeSharedQrSeed(value: string): LifeGrid {
  const bytes = fromBase64Url(value);

  if (bytes.length < 2) {
    throw new Error("The shared QR payload is incomplete.");
  }

  if (bytes[0] !== SHARE_FORMAT_VERSION) {
    throw new Error("The shared QR payload uses an unsupported format.");
  }

  const dimension = bytes[1];

  if (!isSupportedQrDimension(dimension)) {
    throw new Error("The shared QR payload has an unsupported grid size.");
  }

  const totalCellCount = dimension * dimension;
  const expectedByteLength = 2 + Math.ceil(totalCellCount / 8);

  if (bytes.length !== expectedByteLength) {
    throw new Error("The shared QR payload is corrupted.");
  }

  return Array.from({ length: dimension }, (_, rowIndex) =>
    Array.from({ length: dimension }, (_, columnIndex) => {
      const bitOffset = rowIndex * dimension + columnIndex;
      const byteOffset = 2 + Math.floor(bitOffset / 8);
      const bitMask = 1 << (7 - (bitOffset % 8));

      return (bytes[byteOffset] & bitMask) !== 0;
    }),
  );
}
