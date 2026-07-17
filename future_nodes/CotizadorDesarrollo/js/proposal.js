import { REF_TABLES, PROJECT_LABELS, parseHoursRange } from './data.js';
import { fmtMoney } from './calc.js';

export function collectLineItems(state) {
  const items = [];
  const types = state.projectTypes?.length ? state.projectTypes : ['webapp'];

  types.forEach((type) => {
    const rows = REF_TABLES[type]?.rows || [];
    rows.forEach((row, idx) => {
      const key = `${type}:${idx}`;
      if (state.checkedItems?.[key]) {
        items.push({
          category: PROJECT_LABELS[type] || type,
          desc: row[0],
          hours: Math.round(parseHoursRange(row[1])),
        });
      }
    });
  });

  (state.customItems || []).forEach((item) => {
    const hrs = parseFloat(item.hours) || 0;
    if (!item.desc && !hrs) return;
    items.push({
      category: 'Adicional',
      desc: item.desc || 'Ítem personalizado',
      hours: hrs,
    });
  });

  return items;
}

function paymentSchedule(state, result, f) {
  const pay = state.payment;
  if (pay === '-0.05') {
    return [{ label: '100% al inicio del proyecto', amount: result.total }];
  }
  if (pay === '0.10') {
    return [{ label: '100% contra entrega', amount: result.total }];
  }
  const half = Math.round(result.total / 2);
  return [
    { label: '50% adelanto al confirmar', amount: half },
    { label: '50% contra entrega', amount: result.total - half },
  ];
}

export function buildProposalHtml(state, result, meta) {
  const fx = state.currency === 'ARS' ? parseFloat(state.fxRate) || 1 : 1;
  const f = (n) => fmtMoney(n, state.currency, fx);
  const lineItems = collectLineItems(state);
  const rate = result.rate;
  const today = new Date().toLocaleDateString('es-AR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const validDays = parseInt(state.validityDays, 10) || 15;
  const validUntil = new Date(Date.now() + validDays * 864e5).toLocaleDateString('es-AR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const rowsHtml = lineItems.length
    ? lineItems.map((item) => `
        <tr>
          <td><span class="cat">${esc(item.category)}</span>${esc(item.desc)}</td>
          <td class="num">${item.hours}</td>
          <td class="num">${f(rate)}</td>
          <td class="num">${f(item.hours * rate)}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="empty">Sin ítems detallados — estimación global de ${result.hours} hs</td></tr>`;

  const payRows = paymentSchedule(state, result, f)
    .map((p) => `<tr><td>${esc(p.label)}</td><td class="num">${f(p.amount)}</td></tr>`)
    .join('');

  const logo = state.logoDataUrl
    ? `<img src="${state.logoDataUrl}" alt="Logo" class="logo">`
    : '';

  const exclusions = state.exclusions?.trim()
    ? `<section><h2>No incluye</h2><p>${esc(state.exclusions).replace(/\n/g, '<br>')}</p></section>`
    : `<section><h2>No incluye</h2><ul>
        <li>Contenido (textos, fotos, videos) provisto por el cliente</li>
        <li>Hosting, dominio e infraestructura de terceros</li>
        <li>Cambios fuera del alcance acordado (se cotizan aparte)</li>
        <li>Más de 2 rondas de revisiones de diseño</li>
      </ul></section>`;

  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<title>Presupuesto — ${esc(state.projectTitle || 'Proyecto')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a2e; margin: 0; padding: 40px 48px; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0d9488; padding-bottom: 20px; margin-bottom: 28px; }
  .header-left { display: flex; gap: 20px; align-items: center; }
  .logo { max-height: 64px; max-width: 180px; object-fit: contain; }
  .company { font-size: 22px; font-weight: 700; color: #0f766e; margin: 0 0 4px; }
  .company-meta { color: #64748b; font-size: 12px; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 26px; color: #1e293b; }
  .doc-title .date { color: #64748b; font-size: 12px; margin-top: 4px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
  .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
  .meta-box label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 4px; }
  .meta-box span { font-size: 14px; font-weight: 600; color: #334155; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f766e; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { text-align: left; background: #f1f5f9; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cat { display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px; }
  .empty { color: #94a3b8; font-style: italic; }
  .totals { margin-left: auto; width: 320px; margin-top: 16px; }
  .totals table td { border: none; padding: 5px 12px; }
  .totals .grand td { font-size: 16px; font-weight: 700; color: #0f766e; border-top: 2px solid #0d9488; padding-top: 10px; }
  .range { display: flex; gap: 24px; margin-top: 16px; padding: 14px 16px; background: #f0fdfa; border-radius: 8px; border: 1px solid #99f6e4; }
  .range div { flex: 1; text-align: center; }
  .range label { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; }
  .range b { font-size: 15px; color: #0f766e; }
  section ul { margin: 0; padding-left: 18px; color: #475569; }
  section p { color: #475569; margin: 0; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print {
    body { padding: 24px 32px; }
    @page { margin: 16mm; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logo}
      <div>
        <p class="company">${esc(state.companyName || 'Tu empresa')}</p>
        <div class="company-meta">${state.companyEmail ? esc(state.companyEmail) + '<br>' : ''}${state.companyPhone ? esc(state.companyPhone) : ''}</div>
      </div>
    </div>
    <div class="doc-title">
      <h1>Presupuesto</h1>
      <div class="date">${today}</div>
      <div class="date">Válido hasta: ${validUntil}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box"><label>Cliente</label><span>${esc(state.clientName || '—')}</span></div>
    <div class="meta-box"><label>Proyecto</label><span>${esc(state.projectTitle || '—')}</span></div>
    <div class="meta-box"><label>Alcance</label><span>${esc(meta.projectTypes)}</span></div>
    <div class="meta-box"><label>Equipo</label><span>${result.people} persona(s) · ${result.hours} hs estimadas</span></div>
  </div>

  <h2>Detalle de alcance</h2>
  <table>
    <thead><tr><th>Descripción</th><th class="num">Horas</th><th class="num">Tarifa</th><th class="num">Subtotal</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal desarrollo</td><td class="num">${f(result.subtotal)}</td></tr>
      ${result.riskVal ? `<tr><td>Contingencia / riesgo (${Math.round(result.riskPct * 100)}%)</td><td class="num">${f(result.riskVal)}</td></tr>` : ''}
      ${result.urgVal ? `<tr><td>Urgencia (${Math.round(result.urgPct * 100)}%)</td><td class="num">${f(result.urgVal)}</td></tr>` : ''}
      ${result.payPct ? `<tr><td>${result.payPct < 0 ? 'Descuento' : 'Recargo'} pago (${Math.round(Math.abs(result.payPct) * 100)}%)</td><td class="num">${f(result.payVal)}</td></tr>` : ''}
      <tr class="grand"><td>Total recomendado</td><td class="num">${f(result.total)}</td></tr>
    </table>
  </div>

  <div class="range">
    <div><label>Mínimo</label><b>${f(result.min)}</b></div>
    <div><label>Ideal</label><b>${f(result.total)}</b></div>
    <div><label>Premium</label><b>${f(result.max)}</b></div>
  </div>

  <h2>Forma de pago</h2>
  <table><tbody>${payRows}</tbody></table>

  ${state.maintCheck ? `<p><b>Mantenimiento mensual opcional:</b> ${f(result.maintMonthly)}/mes (${state.maintPct}% del proyecto)</p>` : ''}

  ${exclusions}

  <div class="footer">
    Presupuesto estimativo — sujeto a confirmación de alcance final.<br>
    Generado con Cotizador Interno · ${today}
  </div>
</body>
</html>`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openProposalPrint(state, result, meta) {
  const html = buildProposalHtml(state, result, meta);
  const w = window.open('', '_blank');
  if (!w) {
    alert('El navegador bloqueó la ventana. Permití pop-ups para exportar el PDF.');
    return false;
  }
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 300);
  return true;
}

/** ponytail: resize logo client-side, ceiling ~400px wide */
export function resizeLogo(file, maxW = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('invalid image')); };
    img.src = url;
  });
}
