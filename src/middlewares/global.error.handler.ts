import { randomUUID } from "crypto";
import { ErrorRequestHandler } from "express";
import { NextFunction, Request, Response } from "express";
import handleValidationError from "../errors/handle.validation.error";
import handleCastError from "../errors/handle.cast.error";
import ApiError from "../errors/ApiError";
import { IGenericErrorMessage } from "../interfaces/error.message";
import {
  ERROR_CODES,
  IApiEnvelope,
  codeFromStatus,
} from "../shared/apiEnvelope";

// Converts ApiError / Mongoose ValidationError / CastError / generic Error into
// the §9.1 envelope. success+error share ONE shape — the V2 apiClient switches
// on `error.code` (+ requestId for log tracing) instead of parsing messages.
const globalErrorHandler: ErrorRequestHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // If a response was already sent (e.g. controller streamed then threw),
  // delegate to Express's default handler rather than double-sending.
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let message = "Something went wrong !";
  let code: string = ERROR_CODES.INTERNAL_ERROR;
  let details: IGenericErrorMessage[] = [];

  if (error?.name === "ValidationError") {
    const simplified = handleValidationError(error);
    statusCode = simplified.statusCode;
    message = simplified.message;
    details = simplified.errorMessages;
    code = ERROR_CODES.VALIDATION_FAILED;
  } else if (error?.name === "CastError") {
    const simplified = handleCastError(error);
    statusCode = simplified.statusCode;
    message = simplified.message;
    details = simplified.errorMessages;
    code = ERROR_CODES.CAST_ERROR;
  } else if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    // explicit code/details (V2 rich errors) win; else derive from status.
    code = error.code ?? codeFromStatus(statusCode);
    details = error.details?.length
      ? error.details
      : error.message
        ? [{ path: "", message: error.message }]
        : [];
  } else if (error instanceof Error) {
    message = error.message;
    details = error.message ? [{ path: "", message: error.message }] : [];
  }

  const envelope: IApiEnvelope<null> = {
    success: false,
    statusCode,
    message,
    data: null,
    error: {
      code,
      message,
      ...(details.length ? { details } : {}),
    },
    path: res.locals.path ?? req.originalUrl,
    method: res.locals.method ?? req.method,
    requestId: res.locals.requestId ?? randomUUID(),
    timestamp: res.locals.timestamp ?? new Date().toISOString(),
  };

  res.status(statusCode).json(envelope);
};

export default globalErrorHandler;
