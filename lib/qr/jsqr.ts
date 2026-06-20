import jsQR from "jsqr";

type Point = {
  x: number;
  y: number;
};

export type JsQrBitMatrix = {
  get: (x: number, y: number) => boolean;
  height: number;
  set: (x: number, y: number, value: boolean) => void;
  width: number;
};

export type JsQrExtractLocation = {
  alignmentPattern: Point;
  bottomLeft: Point;
  dimension: number;
  topLeft: Point;
  topRight: Point;
};

export type JsQrLocation = {
  bottomLeftCorner: Point;
  bottomLeftFinderPattern: Point;
  bottomRightAlignmentPattern?: Point;
  bottomRightCorner: Point;
  topLeftCorner: Point;
  topLeftFinderPattern: Point;
  topRightCorner: Point;
  topRightFinderPattern: Point;
};

export type JsQrCode = {
  binaryData: Uint8ClampedArray;
  chunks: unknown[];
  data: string;
  location: JsQrLocation;
  matrix: JsQrBitMatrix;
  version: number;
};

type JsQrOptions = {
  inversionAttempts?:
    | "attemptBoth"
    | "dontInvert"
    | "invertFirst"
    | "onlyInvert";
};

type JsQrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  providedOptions?: JsQrOptions,
) => JsQrCode | null;

type JsQrInternals = JsQrFn & {
  binarize: (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    returnInverted: boolean,
  ) => {
    binarized: JsQrBitMatrix;
    inverted?: JsQrBitMatrix;
  };
  extract: (
    image: JsQrBitMatrix,
    location: JsQrExtractLocation,
  ) => {
    mappingFunction: (x: number, y: number) => Point;
    matrix: JsQrBitMatrix;
  };
  locate: (image: JsQrBitMatrix) => JsQrExtractLocation[] | null;
};

export const jsQr = jsQR as unknown as JsQrInternals;
