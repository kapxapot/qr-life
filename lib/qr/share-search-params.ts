const CURRENT_QR_VALUE_SEARCH_PARAM = "v";
const LEGACY_QR_VALUE_SEARCH_PARAM = "value";
const SHARED_QR_SEARCH_PARAM = "qr";

export function readSharedQrValue(searchParams: URLSearchParams) {
  if (searchParams.has(CURRENT_QR_VALUE_SEARCH_PARAM)) {
    return searchParams.get(CURRENT_QR_VALUE_SEARCH_PARAM);
  }

  if (searchParams.has(LEGACY_QR_VALUE_SEARCH_PARAM)) {
    return searchParams.get(LEGACY_QR_VALUE_SEARCH_PARAM);
  }

  return null;
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
