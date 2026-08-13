/**
 * Estrutura preparada para o link de oferta de upgrade (Hotmart).
 * Configure a variável VITE_LINK_UPGRADE_EQUIPE com a URL real da oferta.
 * Enquanto não estiver configurada, a interface apenas orienta o upgrade sem link.
 */
export function linkUpgradeEquipe(): string {
  const url = import.meta.env["VITE_LINK_UPGRADE_EQUIPE"];
  return typeof url === "string" && url.startsWith("https://") ? url : "";
}
