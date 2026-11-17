// The phone apps don't report crashes yet; the web app's version is in error-reporting.web.ts

/** Crash reporting on phones: not set up yet, so nothing is sent. */
export function startErrorReporting(): boolean {
  return false;
}
