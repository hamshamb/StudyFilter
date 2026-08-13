import "express";

declare global {
  namespace Express {
    interface Request {
      /** The exact bytes of the request body, captured by app.ts before JSON parsing. */
      rawBody?: Buffer;
    }
  }
}
