import * as Sentry from '@sentry/react';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import Constants from 'expo-constants';

// Sentry's defaults collect most of this, so every category about people is switched off by name
export const NO_PERSONAL_DATA = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};

// Breadcrumbs that could hold what a student typed, said or tapped on
const PRIVATE_BREADCRUMBS = ['console', 'ui.input', 'ui.click'];

/** Remove anything personal from a crash report before it leaves the browser. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request !== undefined) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
  }
  return event;
}

/** Leave out breadcrumbs that could contain what someone typed or clicked on. */
export function keepBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category !== undefined && PRIVATE_BREADCRUMBS.includes(breadcrumb.category)) {
    return null;
  }
  return breadcrumb;
}

/** Send crashes to Sentry when EXPO_PUBLIC_SENTRY_DSN is set; returns whether reporting is on. */
export function startErrorReporting(
  dsn: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN,
): boolean {
  if (dsn === undefined || dsn === '') {
    return false;
  }
  Sentry.init({
    dsn,
    release: `telmi-web@${Constants.expoConfig?.version ?? 'unknown'}`,
    // The users are minors: nothing about people; session replays and tracing are never added
    dataCollection: NO_PERSONAL_DATA,
    beforeSend: scrubEvent,
    beforeBreadcrumb: keepBreadcrumb,
  });
  return true;
}
