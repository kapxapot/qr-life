const CURRENT_QR_VALUE_SEARCH_PARAM = "v";
const LEGACY_QR_VALUE_SEARCH_PARAM = "value";
const SHARED_QR_SEARCH_PARAM = "qr";
const ROOT_SHARE_PATHNAME = "/";

type SearchParamsRecord = Record<string, string | string[] | undefined>;
type SearchParamsLike = SearchParamsRecord | URLSearchParams;

function readSearchParamValue(searchParams: SearchParamsLike, key: string) {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key);
  }

  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function shouldUseCanonicalValuePath(
  encodedQr: string | null,
  qrValue: string | null,
): qrValue is string {
  return encodedQr === null && qrValue !== null && qrValue.length > 0;
}

export function readSharedQrValue(searchParams: SearchParamsLike) {
  const currentValue = readSearchParamValue(
    searchParams,
    CURRENT_QR_VALUE_SEARCH_PARAM,
  );

  if (currentValue !== null) {
    return currentValue;
  }

  const legacyValue = readSearchParamValue(
    searchParams,
    LEGACY_QR_VALUE_SEARCH_PARAM,
  );

  if (legacyValue !== null) {
    return legacyValue;
  }

  return null;
}

export function createCanonicalValueOnlyHref(searchParams: SearchParamsRecord) {
  const encodedQr = readSearchParamValue(searchParams, SHARED_QR_SEARCH_PARAM);
  const qrValue = readSharedQrValue(searchParams);

  if (!shouldUseCanonicalValuePath(encodedQr, qrValue)) {
    return null;
  }

  const nextSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (
      key === CURRENT_QR_VALUE_SEARCH_PARAM ||
      key === LEGACY_QR_VALUE_SEARCH_PARAM ||
      key === SHARED_QR_SEARCH_PARAM
    ) {
      continue;
    }

    if (typeof value === "string") {
      nextSearchParams.set(key, value);
      continue;
    }

    for (const item of value ?? []) {
      nextSearchParams.append(key, item);
    }
  }

  const nextSearch = nextSearchParams.toString();

  return `/${encodeURIComponent(qrValue)}${nextSearch ? `?${nextSearch}` : ""}`;
}

export function syncSharedScanSearchParams(
  searchParams: URLSearchParams,
  encodedQr: string | null,
  qrValue: string | null,
) {
  if (encodedQr) {
    searchParams.set(SHARED_QR_SEARCH_PARAM, encodedQr);
  } else {
    searchParams.delete(SHARED_QR_SEARCH_PARAM);
  }

  searchParams.delete(LEGACY_QR_VALUE_SEARCH_PARAM);

  if (qrValue === null) {
    searchParams.delete(CURRENT_QR_VALUE_SEARCH_PARAM);
  } else {
    searchParams.set(CURRENT_QR_VALUE_SEARCH_PARAM, qrValue);
  }
}

export function syncSharedScanUrl(
  url: URL,
  encodedQr: string | null,
  qrValue: string | null,
) {
  if (shouldUseCanonicalValuePath(encodedQr, qrValue)) {
    url.pathname = `/${encodeURIComponent(qrValue)}`;
    syncSharedScanSearchParams(url.searchParams, encodedQr, null);
    return;
  }

  url.pathname = ROOT_SHARE_PATHNAME;
  syncSharedScanSearchParams(url.searchParams, encodedQr, qrValue);
}
