export function somenteDigitos(value: string) {
  return value.replace(/\D/g, "");
}

/** Remove o prefixo +55 e devolve apenas o DDD + número (máx. 11 dígitos). */
export function telefoneLocal(value: string | null | undefined) {
  let digits = somenteDigitos(value ?? "");
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  return digits.slice(0, 11);
}

/** Máscara visual brasileira: (11) 91234-5678 */
export function formatarTelefone(value: string | null | undefined) {
  const digits = telefoneLocal(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const cut = rest.length > 8 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`;
}

/** Normaliza para o formato internacional salvo no banco: +5511912345678 */
export function telefoneInternacional(value: string | null | undefined) {
  const digits = telefoneLocal(value);
  return digits ? `+55${digits}` : "";
}
