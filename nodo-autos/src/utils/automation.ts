import type { Vehicle } from "@/types";
import type { SocialPlatformKey } from "@/types";
import { supabase } from "@/shared/lib/supabase";

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || "";
const TENANT_ID =
  (import.meta.env.VITE_TEST_CLIENTE_ID as string | undefined)?.trim() ||
  (import.meta.env.VITE_TEST_TENANT_ID as string | undefined)?.trim() ||
  "";

const PLATFORM_WEBHOOKS: Record<SocialPlatformKey, string> = {
  instagram: import.meta.env.VITE_N8N_WEBHOOK_INSTAGRAM || "",
  facebook: import.meta.env.VITE_N8N_WEBHOOK_FACEBOOK || "",
};

function getWebhookUrl(platform: SocialPlatformKey): string {
  return PLATFORM_WEBHOOKS[platform] || N8N_WEBHOOK_URL;
}

async function uploadBase64ToStorage(
  base64Data: string,
  vehicleId: string,
  index: number,
): Promise<string> {
  if (base64Data.startsWith("http")) return base64Data;

  const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return base64Data;

  const contentType = matches[1];
  const byteCharacters = atob(matches[2]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: contentType });
  const fileName = `${vehicleId}/temp_${index}_${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from("vehicle-photos")
    .upload(fileName, blob, { contentType, upsert: true });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("vehicle-photos").getPublicUrl(fileName);
  return publicUrl;
}

export interface AutomationResponse {
  success: boolean;
  externalId?: string;
  error?: string;
}

export async function getPublicationPayload(
  vehicle: Vehicle,
  platform: SocialPlatformKey,
  description?: string,
  title?: string,
) {
  const publicPhotoUrls = await Promise.all(
    (vehicle.photos || []).map((photo, index) =>
      uploadBase64ToStorage(photo, vehicle.id, index),
    ),
  );

  return {
    action: "publish",
    platform,
    tenantId: TENANT_ID,
    vehicle: {
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      version: vehicle.version,
      price: vehicle.listPrice,
      currency: vehicle.currency,
      showPrice: vehicle.showPrice,
      kilometers: vehicle.kilometers,
      photos: publicPhotoUrls,
      title:
        title ||
        `${vehicle.brand} ${vehicle.model} ${vehicle.version || ""} ${vehicle.year}`.trim(),
      description: description || vehicle.description,
      features: vehicle.features,
    },
  };
}

export async function publishVehicle(
  vehicle: Vehicle,
  platform: SocialPlatformKey,
  description?: string,
  title?: string,
): Promise<AutomationResponse> {
  const webhookUrl = getWebhookUrl(platform);
  if (!webhookUrl) {
    return { success: false, error: `Webhook para ${platform} no configurado` };
  }

  try {
    const payload = await getPublicationPayload(vehicle, platform, description, title);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: Boolean(data.success ?? true),
      externalId: data.externalId,
      error: data.error,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deletePublication(
  externalId: string,
  platform: SocialPlatformKey,
): Promise<AutomationResponse> {
  const webhookUrl = getWebhookUrl(platform);
  if (!webhookUrl) {
    return { success: false, error: `Webhook para ${platform} no configurado` };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        platform,
        tenantId: TENANT_ID,
        externalId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: Boolean(data.success ?? true), error: data.error };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function republishVehicle(
  vehicle: Vehicle,
  platform: SocialPlatformKey,
  externalId: string,
  description?: string,
  title?: string,
): Promise<AutomationResponse> {
  const deleteRes = await deletePublication(externalId, platform);
  if (!deleteRes.success) {
    console.warn("No se pudo borrar la publicación previa, se intentará publicar igual.");
  }
  return publishVehicle(vehicle, platform, description, title);
}

export function isSocialAutomationConfigured(platform: SocialPlatformKey): boolean {
  return Boolean(getWebhookUrl(platform));
}
