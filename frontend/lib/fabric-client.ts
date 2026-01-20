/**
 * Wrapper para importar Fabric.js apenas no cliente
 * Este arquivo garante que o fabric nunca seja importado no servidor
 */

let fabricCache: any = null;

export async function loadFabric(): Promise<any> {
  // Garantir que estamos no cliente
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Fabric.js can only be loaded in the browser");
  }

  // Se já foi carregado, retornar do cache
  if (fabricCache) {
    return fabricCache;
  }

  try {
    // Importação dinâmica que só funciona no cliente
    const fabricModule = await import("fabric");
    fabricCache =
      fabricModule.fabric ||
      fabricModule.default?.fabric ||
      (fabricModule as any).default;

    if (!fabricCache || !fabricCache.Canvas) {
      throw new Error("Fabric.js not properly loaded");
    }

    return fabricCache;
  } catch (error) {
    console.error("Error loading fabric:", error);
    throw error;
  }
}

export function isClient(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
