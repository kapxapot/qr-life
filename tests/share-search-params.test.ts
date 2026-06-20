import { describe, expect, it } from "vitest";
import {
  readSharedQrValue,
  syncSharedScanSearchParams,
} from "../lib/qr/share-search-params";

describe("readSharedQrValue", () => {
  it("prefers the canonical v param", () => {
    const searchParams = new URLSearchParams("value=legacy&v=canonical");

    expect(readSharedQrValue(searchParams)).toBe("canonical");
  });

  it("accepts the legacy value param", () => {
    const searchParams = new URLSearchParams("value=legacy");

    expect(readSharedQrValue(searchParams)).toBe("legacy");
  });
});

describe("syncSharedScanSearchParams", () => {
  it("writes the canonical v param and removes the legacy alias", () => {
    const searchParams = new URLSearchParams("value=legacy&debug=1");

    syncSharedScanSearchParams(searchParams, "encoded-seed", "hello");

    expect(searchParams.get("qr")).toBe("encoded-seed");
    expect(searchParams.get("v")).toBe("hello");
    expect(searchParams.has("value")).toBe(false);
    expect(searchParams.get("debug")).toBe("1");
  });

  it("clears both value aliases when the QR value is absent", () => {
    const searchParams = new URLSearchParams("value=legacy&v=canonical");

    syncSharedScanSearchParams(searchParams, null, null);

    expect(searchParams.has("qr")).toBe(false);
    expect(searchParams.has("v")).toBe(false);
    expect(searchParams.has("value")).toBe(false);
  });
});
