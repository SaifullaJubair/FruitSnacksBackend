import { randomUUID } from "crypto";
import { Response } from "express";
import {
  IApiEnvelope,
  IResponseMeta,
  buildMeta,
} from "./apiEnvelope";

// Controller-facing input. Backward-compatible with the old call sites:
// `{ statusCode, success, message, data, totalData }` still works — when
// `totalData` is given (or page/limit) we derive the §9.1 `meta` block, so the
// 31 existing controllers keep compiling and the V2 apiClient still gets a
// proper envelope. New/migrated controllers can pass `meta` directly or
// `total` + `page` + `limit`.
type IApiResponse<T> = {
  statusCode: number;
  success: boolean;
  message?: string | null;
  data?: T | null;
  meta?: IResponseMeta;
  // pagination inputs (any one path):
  totalData?: number; // legacy alias for `total`
  total?: number;
  page?: number;
  limit?: number;
};

const resolveMeta = <T>(input: IApiResponse<T>): IResponseMeta | undefined => {
  if (input.meta) return input.meta;
  const total = input.total ?? input.totalData;
  if (total === undefined || total === null) return undefined;
  return buildMeta(total, input.page, input.limit);
};

// Emits the §9.1 envelope. Context (requestId/path/method/timestamp) comes from
// res.locals (set by responseContext middleware); a randomUUID fallback keeps
// requestId non-null even if the middleware was bypassed. statusCode is applied
// to the real HTTP status (so courier webhooks expecting 202 still work).
const sendResponse = <T>(res: Response, input: IApiResponse<T>): void => {
  const meta = resolveMeta(input);

  const envelope: IApiEnvelope<T> = {
    success: input.success,
    statusCode: input.statusCode,
    message: input.message ?? null,
    data: input.data ?? null,
    ...(meta ? { meta } : {}),
    path: res.locals.path ?? "",
    method: res.locals.method ?? "",
    requestId: res.locals.requestId ?? randomUUID(),
    timestamp: res.locals.timestamp ?? new Date().toISOString(),
  };

  res.status(input.statusCode).json(envelope);
};

export default sendResponse;
