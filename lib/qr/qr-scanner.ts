export type ScannerStatus =
  | "idle"
  | "starting"
  | "ready"
  | "unsupported"
  | "error";

export function getCameraAccessMessage(error: unknown) {
  if (error instanceof DOMException) {
    const normalizedMessage = error.message.toLowerCase();

    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        if (normalizedMessage.includes("dismiss")) {
          return "Camera permission was dismissed. Please enable camera.";
        }

        return "Camera access is blocked. Allow it in your browser settings, then try again.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No camera was found on this device.";
      case "NotReadableError":
      case "TrackStartError":
        return "The camera is already in use by another app or browser tab.";
      case "SecurityError":
        return "Live QR scanning needs camera access in a secure browser context.";
    }
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes("dismiss")) {
      return "Camera permission was dismissed. Please enable camera.";
    }
  }

  return "Camera access was blocked before scanning started.";
}
