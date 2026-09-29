/**
 * Module-resolution hook for the client tests.
 *
 * The browser client imports shared engine modules by their served path
 * (`/src/world/...`), which Node cannot resolve on its own. Registering this
 * hook maps that prefix onto the real files so client modules can be unit
 * tested exactly as the browser loads them — no build step, no duplicated
 * copies.
 */

let rootUrl = null;

/** @param {{ rootUrl: string }} data */
export async function initialize(data) {
  rootUrl = data.rootUrl;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('/src/')) {
    return nextResolve(new URL(`.${specifier}`, rootUrl).href, context);
  }
  return nextResolve(specifier, context);
}
