/**
 * Cópia de imagens importadas para o Supabase Storage (seção 17).
 *
 * Os bytes são baixados no servidor (anti-SSRF, allowlist de CDN) e enviados ao
 * bucket público `imported-products` no caminho
 *   {company_id}/imported-products/{product_id}/{indice}.{ext}
 *
 * Best-effort: se uma imagem falhar, mantém a URL externa original.
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchImageBytes } from "@/integrations/supabase/importer-actions";
import type { ImportedImage } from "@/types/importedProduct";

const BUCKET = "imported-products";

function extFromContentType(ct: string): string {
  if (/png/i.test(ct)) return "png";
  if (/webp/i.test(ct)) return "webp";
  if (/gif/i.test(ct)) return "gif";
  if (/svg/i.test(ct)) return "svg";
  return "jpg";
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

/**
 * Copia as imagens para o Storage e devolve a lista com as URLs públicas
 * (mantendo a URL original quando a cópia falhar). Limita a quantidade copiada.
 */
export async function copyImagesToStorage(
  images: ImportedImage[],
  productId: string,
  companyId: string,
  max = 8,
): Promise<{ images: ImportedImage[]; copied: number; warnings: string[] }> {
  const warnings: string[] = [];
  let copied = 0;
  const result: ImportedImage[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (i >= max) {
      result.push(img);
      continue;
    }
    try {
      const bytes = await fetchImageBytes({ data: { url: img.url } });
      if (!bytes.success) {
        warnings.push(`imagem ${i + 1}: ${bytes.error}`);
        result.push(img);
        continue;
      }
      const ext = extFromContentType(bytes.contentType);
      const path = `${companyId}/imported-products/${productId}/${i}.${ext}`;
      const blob = base64ToBlob(bytes.base64, bytes.contentType);
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        upsert: true,
        contentType: bytes.contentType,
      });
      if (error) {
        warnings.push(`imagem ${i + 1}: ${error.message}`);
        result.push(img);
        continue;
      }
      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      result.push({ ...img, url: publicUrl });
      copied++;
    } catch (e: any) {
      warnings.push(`imagem ${i + 1}: ${e?.message || e}`);
      result.push(img);
    }
  }

  return { images: result, copied, warnings };
}
