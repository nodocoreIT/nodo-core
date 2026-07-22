/**
 * Extrae texto legible de un PDF de comprobante. La mayoría de los PDFs reales
 * (los que generan apps bancarias/fintech como Ualá, Mercado Pago, etc.)
 * comprimen el contenido de texto (FlateDecode) — un parser naive basado en
 * regex sobre el buffer crudo nunca puede leer eso. Usamos pdf-parse (que
 * descomprime correctamente vía pdf.js) y solo caemos al regex naive como
 * último recurso si la librería no puede procesar el archivo.
 */
export async function extractPdfVisibleText(base64: string): Promise<string> {
  const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");

  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text?.trim();
      if (text) return text;
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    console.warn("[receipt-text-parse] pdf-parse failed, falling back to naive parser", err);
  }

  return extractPdfVisibleTextNaive(buffer);
}

function extractPdfVisibleTextNaive(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];
  const paren = /\(([^)\\\n]{2,120})\)/g;
  let m: RegExpExecArray | null;
  while ((m = paren.exec(raw))) {
    const t = m[1].replace(/\\n/g, " ").replace(/\\\(/g, "(").trim();
    if (/[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9$]/.test(t)) chunks.push(t);
  }
  return chunks.join(" ");
}

/**
 * Fallback gratuito (sin cuota) para leer una foto/imagen de comprobante
 * cuando Gemini no está disponible (cuota agotada, sin API key, error). OCR
 * local vía Tesseract.js — no llama a ningún servicio externo. Es menos
 * preciso que Gemini (no entiende contexto, solo lee texto plano), pero el
 * texto que devuelve se procesa con el mismo parser heurístico que ya usamos
 * para los PDF (parseTransferReceiptText).
 */
export async function extractImageVisibleText(base64: string): Promise<string> {
  const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");

  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("spa");
    try {
      const result = await worker.recognize(buffer);
      return result.data.text?.trim() ?? "";
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    console.warn("[receipt-text-parse] tesseract OCR failed", err);
    return "";
  }
}

export interface ParsedTransferReceipt {
  amount?: number;
  date?: string;
  time?: string;
  /** Nombre y apellido del titular de la cuenta/alias destino. */
  holderName?: string;
  /** Alias del destinatario, si el comprobante lo muestra (no todos lo hacen). */
  alias?: string;
  cbu?: string;
  payerName?: string;
  operationId?: string;
}

function parseArAmount(raw: string): number | undefined {
  const m = raw.match(/\$\s*([\d.]+(?:,\d{2})?)/);
  if (!m) return undefined;
  const normalized = m[1].replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Parser heurístico para comprobantes de transferencia argentinos (MP, bancos). */
export function parseTransferReceiptText(text: string): ParsedTransferReceipt {
  const flat = text.replace(/\s+/g, " ").trim();
  const result: ParsedTransferReceipt = {};

  const amountMatch =
    flat.match(/Monto debitado\s*\$?\s*([\d.]+(?:,\d{2})?)/i) ||
    flat.match(/Importe\s*\$?\s*([\d.]+(?:,\d{2})?)/i) ||
    flat.match(/Total\s*\$?\s*([\d.]+(?:,\d{2})?)/i);
  if (amountMatch) {
    const normalized = amountMatch[1].replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    if (Number.isFinite(n) && n > 0) result.amount = n;
  }

  const dateMatch = flat.match(
    /Fecha y hora\s+(\d{1,2})\s+de\s+(\w+)\s+(\d{4})\s*[-–]?\s*(\d{1,2}:\d{2})/i,
  );
  if (dateMatch) {
    const months: Record<string, string> = {
      enero: "01",
      febrero: "02",
      marzo: "03",
      abril: "04",
      mayo: "05",
      junio: "06",
      julio: "07",
      agosto: "08",
      septiembre: "09",
      setiembre: "09",
      octubre: "10",
      noviembre: "11",
      diciembre: "12",
    };
    const month = months[dateMatch[2].toLowerCase()];
    if (month) {
      result.date = `${dateMatch[3]}-${month}-${dateMatch[1].padStart(2, "0")}`;
      result.time = dateMatch[4];
    }
  }

  // Mercado Pago usa el formato "De <remitente> ... Para <destinatario> ...",
  // sin las etiquetas "Cuenta destino"/"CBU destino" que sí usan los bancos.
  // Todo lo que aparece antes de "Para" es el remitente — hay que buscar el
  // CBU/CVU y el titular SOLO en la sección posterior a "Para", si no
  // terminamos tomando los datos de quien envía el pago en vez de a quién.
  const paraIdx = flat.search(/\bPara\b/i);
  const recipientSection = paraIdx >= 0 ? flat.slice(paraIdx) : flat;
  const senderSection = paraIdx >= 0 ? flat.slice(0, paraIdx) : "";

  const destMatch = flat.match(
    /Cuenta destino\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s.]+?)(?:\s+Cuenta destino|\s+CUIT|\s+CBU|$)/i,
  );
  const mpHolderMatch = recipientSection.match(
    /\bPara\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s.]+?)(?:\s+CUIT|\s+CBU|\s+CVU|$)/i,
  );
  if (destMatch) {
    result.holderName = destMatch[1].trim();
  } else if (mpHolderMatch) {
    result.holderName = mpHolderMatch[1].trim();
  }

  const aliasMatch = flat.match(
    /Alias(?:\s+destino)?\s*[:\s]\s*([a-zA-Z0-9][a-zA-Z0-9.]{2,30})/i,
  );
  if (aliasMatch) result.alias = aliasMatch[1].trim();

  const cbuMatch =
    recipientSection.match(/\b(\d{22})\b/) || flat.match(/\b(\d{22})\b/);
  if (cbuMatch) result.cbu = cbuMatch[1];

  const payerMatch = flat.match(
    /Nombre remitente\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s.]+?)(?:\s+Concepto|\s+id Op|$)/i,
  );
  const mpPayerMatch = senderSection.match(
    /\bDe\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s.]+?)(?:\s+CUIT|\s+CBU|\s+CVU|$)/i,
  );
  if (payerMatch) {
    result.payerName = payerMatch[1].trim();
  } else if (mpPayerMatch) {
    result.payerName = mpPayerMatch[1].trim();
  }

  const opMatch =
    flat.match(/\bid\s*Op\.?\s*[#:]?\s*([A-Z0-9][A-Z0-9-]{5,})/i) ||
    flat.match(
      /N[°º.]?\s*(?:de\s*)?operaci[oó]n[:\s#]*([A-Z0-9][A-Z0-9-]{5,})/i,
    ) ||
    flat.match(
      /C[oó]digo de operaci[oó]n[:\s#]*([A-Z0-9][A-Z0-9-]{5,})/i,
    ) ||
    flat.match(/ID\s*transacci[oó]n[:\s#]*([A-Z0-9][A-Z0-9-]{5,})/i);
  if (opMatch) result.operationId = opMatch[1];

  if (!result.amount) result.amount = parseArAmount(flat);

  return result;
}
