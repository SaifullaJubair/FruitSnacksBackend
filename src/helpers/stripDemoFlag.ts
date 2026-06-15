/**
 * stripDemoFlag — defensive guard for the demo-seed `is_demo` marker.
 *
 * `is_demo` must ONLY ever be set true by `npm run seed:demo`. It is the single
 * key the Admin "Clear demo data" button keys off of, so if a normal admin
 * create/update payload could carry `is_demo:true` (by accident, a copied JSON,
 * or a malicious client), the client's REAL catalog rows could be wiped by the
 * Clear button. We strip the field from every request body that flows through a
 * create/update controller so it is impossible to set via the API.
 *
 * Call this at the top of each catalog create/update controller, right after
 * reading req.body. Mutates in place AND returns the same object for chaining.
 * Handles the multipart case too: when a field arrives as the string "true"
 * (multipart form-data has no booleans), it is still removed.
 */
export const stripDemoFlag = <T extends Record<string, any>>(body: T): T => {
  if (body && typeof body === "object") {
    delete (body as any).is_demo;
  }
  return body;
};
