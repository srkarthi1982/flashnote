import type { FlashnoteDashboardSummaryV1 } from "../dashboard/summary.schema";

const getWebhookUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/$/, "")}/api/webhooks/flashnote-activity.json`;

type FlashnoteActivity = {
  event: string;
  occurredAt: string;
  entityId?: string;
};

export const pushFlashnoteActivity = (params: {
  userId: string;
  activity: FlashnoteActivity;
  summary: FlashnoteDashboardSummaryV1;
}): void => {
  try {
    const baseUrl = import.meta.env.PARENT_APP_URL;
    const secret = import.meta.env.ANSIVERSA_WEBHOOK_SECRET;

    if (!baseUrl || !secret) {
      if (import.meta.env.DEV) {
        console.warn(
          "pushFlashnoteActivity skipped: missing PARENT_APP_URL or ANSIVERSA_WEBHOOK_SECRET",
        );
      }
      return;
    }

    const url = getWebhookUrl(baseUrl);
    const payload = {
      userId: params.userId,
      appId: "flashnote",
      activity: params.activity,
      summary: params.summary,
    };

    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ansiversa-Signature": secret,
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("pushFlashnoteActivity failed", error);
    }
  }
};
