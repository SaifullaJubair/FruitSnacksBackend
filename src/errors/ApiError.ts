// Optional rich-error fields for the V2 §9.1 envelope. V1 call sites pass only
// (statusCode, message[, stack]) and keep working — `code`/`details` are
// additive and read by global.error.handler when present.
type ErrorDetail = { path: string | number; message: string };

class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: ErrorDetail[];

  constructor(
    statusCode: number,
    message: string | undefined,
    code?: string,
    details?: ErrorDetail[],
    stack = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
