import api from "./api";

export interface PresignUrlRequest {
  type: "post" | "template";
  fileName: string;
  contentType: string;
}

export interface PresignUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}

// Cache da URL do worker para conversão de URLs antigas
let workerBaseUrl: string | null = null;

/**
 * Converte uma URL do R2 diretamente para URL do worker (versão síncrona usando cache)
 * Útil para URLs antigas que ainda apontam para o R2 diretamente
 * @param r2Url URL do R2 (ex: https://promouork.xxx.r2.cloudflarestorage.com/users/...)
 * @returns URL do worker ou a URL original se já for do worker ou se cache não estiver disponível
 */
export function convertR2UrlToWorkerUrl(r2Url: string): string {
  if (!r2Url) return r2Url;

  // Se já for URL do worker, retornar como está
  if (
    r2Url.includes(".workers.dev") ||
    r2Url.includes("cloudflareworkers.com")
  ) {
    return r2Url;
  }

  // Se for URL do R2 diretamente, extrair o path e converter
  // Exemplo: https://promouork.xxx.r2.cloudflarestorage.com/users/xxx/posts/xxx.png
  // Para: https://promouork.xxx.workers.dev/users/xxx/posts/xxx.png
  try {
    const url = new URL(r2Url);
    const path = url.pathname; // /users/xxx/posts/xxx.png

    // Se temos a URL do worker em cache, usar ela
    if (workerBaseUrl) {
      return `${workerBaseUrl}${path}`;
    }

    // Se não temos cache, retornar a URL original
    // O cache será preenchido na próxima vez que fizer upload
    return r2Url;
  } catch {
    // Se não for uma URL válida, retornar como está
    return r2Url;
  }
}

/**
 * Converte uma URL do R2 para URL do worker de forma assíncrona
 * Busca a URL do worker do backend se o cache não estiver disponível
 * @param r2Url URL do R2
 * @returns Promise com URL do worker
 */
export async function convertR2UrlToWorkerUrlAsync(
  r2Url: string
): Promise<string> {
  // Tentar versão síncrona primeiro (usa cache se disponível)
  const syncResult = convertR2UrlToWorkerUrl(r2Url);
  if (
    syncResult !== r2Url ||
    r2Url.includes(".workers.dev") ||
    r2Url.includes("cloudflareworkers.com")
  ) {
    return syncResult;
  }

  // Se não funcionou e não temos cache, buscar do backend
  try {
    const { uploadUrl } = await getPresignedUrl({
      type: "post",
      fileName: "dummy.png",
      contentType: "image/png",
    });

    if (
      uploadUrl.includes(".workers.dev") ||
      uploadUrl.includes("cloudflareworkers.com")
    ) {
      setWorkerBaseUrl(uploadUrl);
      const url = new URL(r2Url);
      const workerUrl = new URL(uploadUrl);
      return `${workerUrl.origin}${url.pathname}`;
    }
  } catch {
    // Se falhar, retornar a URL original
  }

  return r2Url;
}

/**
 * Atualiza o cache da URL do worker base
 * @param uploadUrl URL de upload do worker
 */
export function setWorkerBaseUrl(uploadUrl: string): void {
  if (
    uploadUrl.includes(".workers.dev") ||
    uploadUrl.includes("cloudflareworkers.com")
  ) {
    try {
      const url = new URL(uploadUrl);
      workerBaseUrl = url.origin; // https://promouork.xxx.workers.dev
    } catch {
      // Ignorar erro
    }
  }
}

/**
 * Solicita uma presigned URL do backend para upload de imagem
 */
export async function getPresignedUrl(
  request: PresignUrlRequest
): Promise<PresignUrlResponse> {
  const response = await api.post<PresignUrlResponse>(
    "/storage/presign-url",
    request
  );
  return response.data;
}

/**
 * Deleta uma imagem do R2
 * @param imageUrl URL pública da imagem a ser deletada
 * @returns true se deletado com sucesso
 */
export async function deleteImageFromR2(imageUrl: string): Promise<boolean> {
  if (!imageUrl || imageUrl.startsWith("data:image/")) {
    return false; // Não deletar base64 ou URLs inválidas
  }

  try {
    const response = await api.delete<{ success: boolean }>("/storage/image", {
      data: { imageUrl },
    });
    return response.data.success;
  } catch (error: any) {
    console.error("Error deleting image:", error);
    return false;
  }
}

/**
 * Faz upload de uma imagem (base64 ou Blob) para R2 usando worker ou presigned URL
 * @param imageData Imagem em base64 ou Blob
 * @param type Tipo de imagem ('post' ou 'template')
 * @returns URL pública da imagem no R2
 */
export async function uploadImageToR2(
  imageData: string | Blob,
  type: "post" | "template"
): Promise<string> {
  // Determinar content type e nome do arquivo
  let blob: Blob;
  let contentType: string;
  let fileName: string;

  if (typeof imageData === "string") {
    // É base64
    const base64Data = imageData.split(",")[1] || imageData;
    const mimeMatch = imageData.match(/data:([^;]+);base64/);
    contentType = mimeMatch ? mimeMatch[1] : "image/png";
    fileName = `image.${contentType.split("/")[1] || "png"}`;

    // Converter base64 para Blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    blob = new Blob([byteArray], { type: contentType });
  } else {
    // Já é um Blob
    blob = imageData;
    contentType = blob.type || "image/png";
    fileName = `image.${contentType.split("/")[1] || "png"}`;
  }

  // Solicitar URL de upload (worker ou presigned URL)
  const { uploadUrl, publicUrl } = await getPresignedUrl({
    type,
    fileName,
    contentType,
  });

  // Detectar se é worker (URL do worker geralmente não contém query params de S3)
  // Worker URLs geralmente são do tipo: https://promouork.xxx.workers.dev
  const isWorker =
    uploadUrl.includes(".workers.dev") ||
    uploadUrl.includes("cloudflareworkers.com");

  // Atualizar cache da URL do worker para conversão de URLs antigas
  if (isWorker) {
    setWorkerBaseUrl(uploadUrl);
  }

  if (isWorker) {
    // Upload via worker (resolve problemas de CORS)
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      throw new Error("Token de autenticação não encontrado");
    }

    // Obter userId do token (decodificar JWT)
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.sub;
    } catch {
      throw new Error("Token inválido");
    }

    // Criar FormData para enviar ao worker
    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("userId", userId);
    formData.append("type", type);
    formData.append("fileName", fileName);
    formData.append("contentType", contentType);
    formData.append("token", token);

    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        // Evitar cancelamento prematuro
        signal: undefined,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `Failed to upload image: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      const result = await uploadResponse.json();
      if (!result.publicUrl) {
        throw new Error("Worker não retornou publicUrl");
      }
      return result.publicUrl;
    } catch (error: any) {
      // Re-throw com mensagem mais clara
      if (error.name === "AbortError") {
        throw new Error("Upload cancelado");
      }
      if (error.message) {
        throw error;
      }
      throw new Error(
        `Erro ao fazer upload: ${error.message || "Erro desconhecido"}`
      );
    }
  } else {
    // Upload direto via presigned URL (pode ter problemas de CORS)
    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": contentType,
        },
        // Evitar cancelamento prematuro
        signal: undefined,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Failed to upload image: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      return publicUrl;
    } catch (error: any) {
      // Re-throw com mensagem mais clara
      if (error.name === "AbortError") {
        throw new Error("Upload cancelado");
      }
      if (error.message) {
        throw error;
      }
      throw new Error(
        `Erro ao fazer upload: ${error.message || "Erro desconhecido"}`
      );
    }
  }
}
