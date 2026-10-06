/**
 * Scaffold marker. Every stub below lands in build step 2 ("Core: PRNG, noise,
 * layout, path builder, tear library, renderSvg"). Throwing keeps the shape
 * reviewable without any module quietly returning plausible-looking rubbish.
 */
export function notImplemented(what: string): never {
  throw new Error(`[@leima/core] ${what} is not implemented yet (build step 2).`);
}
