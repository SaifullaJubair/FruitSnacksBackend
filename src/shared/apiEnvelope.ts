// §9.1 (master plan §17d D5) — the standardized V2 response envelope.
// Every endpoint (success AND error) returns ONE shape so the V2 apiClient
// reads `json.data` / `json.meta` / `json.error.code` / `json.requestId` and
// never re-maps or string-matches messages. See DATA_LAYER_AND_STRUCTURE.md §9.1.

export interface IResponseMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface IResponseError {
  code: string;
  message: string;
  details?: { path: string | number; message: string }[];
}

export interface IApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string | null;
  data: T | null;
  meta?: IResponseMeta;
  error?: IResponseError;
  path: string;
  method: string;
  requestId: string;
  timestamp: string;
}

// Canonical error codes — V2 `packages/types` mirrors this list so the UI can
// switch on `error.code` instead of parsing English messages. Extend per slice
// (auth slice adds INVALID_CREDENTIALS, OTP_EXPIRED, etc.).
export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  CAST_ERROR: "CAST_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
} as const;

// Map an HTTP status to a default error code (used when a thrown ApiError
// carries no explicit code). 1:1 for the common cases, INTERNAL_ERROR otherwise.
export const codeFromStatus = (statusCode: number): string => {
  switch (statusCode) {
    case 400:
      return ERROR_CODES.BAD_REQUEST;
    case 401:
      return ERROR_CODES.UNAUTHORIZED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 409:
      return ERROR_CODES.CONFLICT;
    default:
      return statusCode >= 500
        ? ERROR_CODES.INTERNAL_ERROR
        : ERROR_CODES.BAD_REQUEST;
  }
};

// Build the `meta` block from raw pagination inputs. Guards against missing /
// NaN page & limit (controllers do `Number(req.query.page)` which is NaN when
// the query param is absent — see brand.controllers.ts). When limit is unusable
// we treat the whole result as a single page so totalPages/hasNext stay sane.
export const buildMeta = (
  total: number,
  page?: number,
  limit?: number,
): IResponseMeta => {
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : 0;
  const safePage = Number.isFinite(page) && (page as number) > 0 ? (page as number) : 1;
  const safeLimit =
    Number.isFinite(limit) && (limit as number) > 0
      ? (limit as number)
      : safeTotal || 1;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    totalPages,
    hasNext: safePage < totalPages,
  };
};
