import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createWhatsAppProvider } from "./whatsapp-provider.ts";

const message = {
  notificationId: "00000000-0000-4000-8000-000000000003",
  tenantId: "00000000-0000-4000-8000-000000000001",
  recipient: "+5585999999999",
  template: "booking_created" as const,
  variables: { client: "Maria" },
};

describe("WhatsApp provider architecture", () => {
  it("keeps development mode local and simulated", async () => {
    const provider = createWhatsAppProvider("development", {
      phoneNumberId: null,
      businessAccountId: null,
      accessTokenSecretName: "META_WHATSAPP_ACCESS_TOKEN",
      webhookVerifySecretName: "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    });

    assert.equal(provider.name, "development");
    assert.deepEqual(await provider.send(message), {
      status: "development",
      detail: "Mensagem registrada para visualização. Nenhuma integração externa foi chamada.",
    });
  });

  it("never sends through Meta while the transport is disabled", async () => {
    const provider = createWhatsAppProvider("cloud_api", {
      phoneNumberId: "phone-id",
      businessAccountId: "business-id",
      accessTokenSecretName: "META_WHATSAPP_ACCESS_TOKEN",
      webhookVerifySecretName: "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    });

    assert.equal(provider.name, "meta_whatsapp_cloud_api");
    assert.equal((await provider.send(message)).status, "configuration_required");
  });
});
