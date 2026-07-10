import { describe, expect, it } from "vitest";
import {
  createCanonicalValueOnlyHref,
  readSharedQrValue,
  syncSharedScanSearchParams,
  syncSharedScanUrl,
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

describe("createCanonicalValueOnlyHref", () => {
  it("rewrites value-only share urls to the pathname", () => {
    expect(
      createCanonicalValueOnlyHref({
        debug: "1",
        v: "hello world",
      }),
    ).toBe("/hello%20world?debug=1");
  });

  it("keeps qr share urls on the root route", () => {
    expect(
      createCanonicalValueOnlyHref({
        qr: "encoded-seed",
        v: "hello",
      }),
    ).toBeNull();
  });
});

describe("syncSharedScanUrl", () => {
  it("uses the pathname as the canonical location for value-only shares", () => {
    const url = new URL("https://example.com/?debug=1");

    syncSharedScanUrl(url, null, "hello world");

    expect(url.pathname).toBe("/hello%20world");
    expect(url.search).toBe("?debug=1");
  });

  it("keeps qr share urls rooted and query-based", () => {
    const url = new URL("https://example.com/hello?debug=1");

    syncSharedScanUrl(url, "encoded-seed", "hello");

    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("debug")).toBe("1");
    expect(url.searchParams.get("qr")).toBe("encoded-seed");
    expect(url.searchParams.get("v")).toBe("hello");
  });
});
