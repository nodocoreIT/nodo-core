// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
}

export type DniUploadResult =
  | { ok: true; dniFrontPath: string | null; dniBackPath: string | null }
  | { ok: false; error: string; side: "front" | "back"; cause: unknown };

/** Uploads optional DNI front/back photos to the shared registration-docs bucket. */
export async function uploadDniDocs(
  serviceClient: AnyClient,
  userId: string,
  dniFront: File | null,
  dniBack: File | null,
): Promise<DniUploadResult> {
  let dniFrontPath: string | null = null;
  let dniBackPath: string | null = null;

  if (dniFront && dniFront.size > 0) {
    const ext = getExtension(dniFront.name);
    const storagePath = `${userId}/dni_front.${ext}`;
    const buffer = await dniFront.arrayBuffer();

    const { error: uploadError } = await serviceClient.storage
      .from("clinic-registration-docs")
      .upload(storagePath, buffer, {
        contentType: dniFront.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, error: "Error al subir DNI frente. Reintentá.", side: "front", cause: uploadError };
    }

    dniFrontPath = storagePath;
  }

  if (dniBack && dniBack.size > 0) {
    const ext = getExtension(dniBack.name);
    const storagePath = `${userId}/dni_back.${ext}`;
    const buffer = await dniBack.arrayBuffer();

    const { error: uploadError } = await serviceClient.storage
      .from("clinic-registration-docs")
      .upload(storagePath, buffer, {
        contentType: dniBack.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, error: "Error al subir DNI dorso. Reintentá.", side: "back", cause: uploadError };
    }

    dniBackPath = storagePath;
  }

  return { ok: true, dniFrontPath, dniBackPath };
}
