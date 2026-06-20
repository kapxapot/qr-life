import qrcodeGenerator from "qrcode-generator";
import type { LifeGrid } from "@/lib/game-of-life/game-of-life";

const UTF8_ENCODER = new TextEncoder();

qrcodeGenerator.stringToBytes = (value: string) => [
  ...UTF8_ENCODER.encode(value),
];

function getGenerationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith("code length overflow")) {
    return "The text is too long to fit in a QR code.";
  }

  return message;
}

export function createQrSeedFromText(text: string): LifeGrid {
  if (text.length === 0) {
    throw new Error("Enter some text to generate a QR code.");
  }

  try {
    const qrCode = qrcodeGenerator(0, "M");

    qrCode.addData(text, "Byte");
    qrCode.make();

    const moduleCount = qrCode.getModuleCount();

    return Array.from({ length: moduleCount }, (_, rowIndex) =>
      Array.from({ length: moduleCount }, (_, columnIndex) =>
        qrCode.isDark(rowIndex, columnIndex),
      ),
    );
  } catch (error) {
    throw new Error(getGenerationErrorMessage(error));
  }
}
