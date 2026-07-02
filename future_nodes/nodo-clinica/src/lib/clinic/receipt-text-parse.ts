/** Extrae texto legible de un PDF de comprobante (sin dependencias externas). */
export function extractPdfVisibleText(base64: string): string {
  const raw = Buffer.from(
    base64.replace(/^data:[^;]+;base64,/, ""),
    "base64",
  ).toString("latin1");

  const chunks: string[] = [];
  const paren = /\(([^)\\\n]{2,120})\)/g;
  let m: RegExpExecArray | null;
  while ((m = paren.exec(raw))) {
    const t = m[1].replace(/\\n/g, " ").replace(/\\\(/g, "(").trim();
    if (/[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9$]/.test(t)) chunks.push(t);
  }
  return chunks.join(" ");
}

export interface ParsedTransferReceipt {
  amount?: number;
  date?: string;
  time?: string;
  recipient?: string;
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

  const destMatch = flat.match(
    /Cuenta destino\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s.]+?)(?:\s+Cuenta destino|\s+CUIT|\s+CBU|$)/i,
  );
  if (destMatch) {
    result.recipient = destMatch[1].trim();
  }

  const cbuMatch = flat.match(/\b(\d{22})\b/);
  if (cbuMatch) result.cbu = cbuMatch[1];

  const payerMatch = flat.match(
    /Nombre remitente\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s.]+?)(?:\s+Concepto|\s+id Op|$)/i,
  );
  if (payerMatch) result.payerName = payerMatch[1].trim();

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
