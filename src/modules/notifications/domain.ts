export type NotificationChannel = "dashboard" | "whatsapp";
export type NotificationStatus =
  "pending" | "development" | "processing" | "sent" | "failed" | "cancelled";

export interface WhatsAppNotificationMessage {
  notificationId: string;
  tenantId: string;
  recipient: string;
  template: "booking_created" | "booking_confirmed" | "booking_cancelled" | "marketing_message";
  variables: Record<string, string | number | null>;
}

export interface WhatsAppDeliveryResult {
  status: "development" | "configuration_required" | "sent" | "failed";
  providerMessageId?: string;
  detail: string;
}

export interface WhatsAppProvider {
  readonly name: "development" | "meta_whatsapp_cloud_api";
  send(message: WhatsAppNotificationMessage): Promise<WhatsAppDeliveryResult>;
}
