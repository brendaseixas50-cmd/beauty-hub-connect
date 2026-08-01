import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export function useMvpAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(task: () => Promise<unknown>, success: string) {
    setPending(true);
    try {
      await task();
      toast.success(success);
      await router.invalidate();
      return true;
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível concluir a operação.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, run };
}
