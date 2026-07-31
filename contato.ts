/** Monta um link wa.me a partir de um telefone brasileiro formatado. */
export function linkWhatsapp(telefone: string, negocio: string) {
  const digitos = telefone.replace(/\D/g, "");
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  const texto = encodeURIComponent(
    `Olá! Vim pela página do ${negocio} e gostaria de agendar um horário.`,
  );
  return `https://wa.me/${numero}?text=${texto}`;
}

/** Link de perfil do Instagram a partir do @usuario. */
export function linkInstagram(usuario: string) {
  return `https://instagram.com/${usuario.replace(/^@/, "")}`;
}
