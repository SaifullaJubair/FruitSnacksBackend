import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

// Stamps every request with the envelope context (requestId/path/method/
// timestamp) on res.locals so sendResponse and the global error handler can
// emit the §9.1 envelope WITHOUT each controller having to pass `req`.
// MUST be mounted before any route (and before anything that may short-circuit
// a response) so res.locals is always populated. requestId mirrors the value
// pino-http already logs, enabling one-call trace across logs.
export const responseContext = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.locals.requestId = randomUUID();
  res.locals.path = req.originalUrl;
  res.locals.method = req.method;
  res.locals.timestamp = new Date().toISOString();
  next();
};
