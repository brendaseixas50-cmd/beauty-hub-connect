import type {
  WhatsAppDeliveryResult,
  WhatsAppNotificationMessage,
  WhatsAppProvider,
} from "./domain";

export interface MetaWhatsAppConfiguration {
  phoneNumberId: string | null;
  businessAccountId: string | null;
  accessTokenSecretName: string;
  webhookVerifySecretName: string;
}

class DevelopmentWhatsAppProvider implements WhatsAppProvider {
  readonly name = "development" as const;

  async send(_message: WhatsAppNotificationMessage): Promise<WhatsAppDeliveryResult> {
    return {
      status: "development",
      detail: "Mensagem registrada para visualização. Nenhuma integração externa foi chamada.",
    };
  }
}

class MetaWhatsAppCloudProvider implements WhatsAppProvider {
  readonly name = "meta_whatsapp_cloud_api" as const;
  private readonly configuration: MetaWhatsAppConfiguration;

  constructor(configuration: MetaWhatsAppConfiguration) {
    this.configuration = configuration;
  }

  async send(_message: WhatsAppNotificationMessage): Promise<WhatsAppDeliveryResult> {
    const configured = Boolean(
      this.configuration.phoneNumberId &&
      this.configuration.businessAccountId &&
      this.configuration.accessTokenSecretName,
    );
    return {
      status: "configuration_required",
      detail: configured
        ? "Estrutura Meta configurada; o transporte real permanece desativado nesta etapa."
        : "Informe as referências Meta e o segredo no servidor antes de ativar o transporte.",
    };
  }
}

export function createWhatsAppProvider(
  mode: "development" | "cloud_api",
  configuration: MetaWhatsAppConfiguration,
): WhatsAppProvider {
  return mode === "development"
    ? new DevelopmentWhatsAppProvider()
    : new MetaWhatsAppCloudProvider(configuration);
}
