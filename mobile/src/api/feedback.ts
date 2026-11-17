import { apiClient } from '@/api/client';

export type ProblemReport = {
  message: string;
  page: string;
  app_version: string;
};

/** Send a problem report to the team; nothing comes back but a success. */
export async function sendFeedback(report: ProblemReport): Promise<void> {
  await apiClient.request<null>('POST', '/feedback', { body: report });
}
