import { REF_TABLES, PROJECT_TYPES, PROJECT_LABELS, parseHoursRange } from './data.js';
import { calculate, fmtMoney, buildQuoteText } from './calc.js';
import { collectLineItems, openProposalPrint, resizeLogo } from './proposal.js';

const STORAGE_KEY = 'cotizador-state-v2';
const LOGO_KEY = 'cotizador-logo';

const $ = (id) => document.getElementById(id);

const state = {
  rateProfile: '28',
  customRate: '30',
  projectTypes: ['webapp'],
  hours: '120',
  people: '2',
  risk: '0.20',
  urgency: '0',
  payment: '0',
  maintCheck: false,
  maintPct: '8',
  currency: 'USD',
  fxRate: '1200',
  checkedItems: {},
  customItems: [],
  hoursManual: false,
  companyName: '',
  companyEmail: '',
  companyPhone: '',
  clientName: '',
  projectTitle: '',
  validityDays: '15',
  exclusions: '',
  logoDataUrl: '',
};

let saveTimer;

function migrateState(raw) {
  if (raw.projectType && !raw.projectTypes) {
    raw.projectTypes = raw.projectType === 'mixto' ? ['webapp', 'n8n'] : [raw.projectType];
    delete raw.projectType;
  }
  if (!raw.projectTypes?.length) raw.projectTypes = ['webapp'];
  return raw;
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw) Object.assign(state, migrateState(raw));
    state.logoDataUrl = localStorage.getItem(LOGO_KEY) || '';
  } catch (_) { /* ponytail: corrupt storage → defaults */ }
}

function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { logoDataUrl, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    if (logoDataUrl) localStorage.setItem(LOGO_KEY, logoDataUrl);
    else localStorage.removeItem(LOGO_KEY);
  }, 300);
}

function checklistKey(type, idx) {
  return `${type}:${idx}`;
}

function getChecklistHours() {
  let sum = 0;
  (state.projectTypes || []).forEach((type) => {
    (REF_TABLES[type]?.rows || []).forEach((row, idx) => {
      if (state.checkedItems[checklistKey(type, idx)]) {
        sum += parseHoursRange(row[1]);
      }
    });
  });
  state.customItems.forEach((item) => {
    sum += parseFloat(item.hours) || 0;
  });
  return Math.round(sum);
}

function syncHoursFromChecklist() {
  const h = getChecklistHours();
  if (h > 0) {
    state.hours = String(h);
    state.hoursManual = false;
    $('hours').value = state.hours;
    updateHoursNote();
  }
}

function updateHoursNote() {
  const el = $('hoursNote');
  const checklistH = getChecklistHours();
  if (state.hoursManual) {
    el.textContent = 'Editaste las horas a mano. Usá "Sincronizar con checklist" para volver al total de ítems.';
    el.className = 'hours-note manual';
  } else if (checklistH > 0) {
    el.textContent = `Horas calculadas desde ${countCheckedItems()} ítem(s) en ${state.projectTypes.length} categoría(s).`;
    el.className = 'hours-note';
  } else {
    el.textContent = 'Marcá categorías e ítems abajo, o ingresá las horas manualmente.';
    el.className = 'hours-note';
  }
}

function countCheckedItems() {
  let n = state.checkedItems ? Object.values(state.checkedItems).filter(Boolean).length : 0;
  n += state.customItems.filter((i) => i.desc || parseFloat(i.hours)).length;
  return n;
}

function getProjectTypesLabel() {
  return state.projectTypes.map((t) => PROJECT_LABELS[t] || t).join(' + ');
}

function readForm() {
  state.rateProfile = $('rateProfile').value;
  state.customRate = $('customRate').value;
  state.hours = $('hours').value;
  state.people = $('people').value;
  state.risk = $('risk').value;
  state.urgency = $('urgency').value;
  state.payment = $('payment').value;
  state.maintCheck = $('maintCheck').checked;
  state.maintPct = $('maintPct').value;
  state.currency = $('currency').value;
  state.fxRate = $('fxRate').value;
  state.companyName = $('companyName').value;
  state.companyEmail = $('companyEmail').value;
  state.companyPhone = $('companyPhone').value;
  state.clientName = $('clientName').value;
  state.projectTitle = $('projectTitle').value;
  state.validityDays = $('validityDays').value;
  state.exclusions = $('exclusions').value;
}

function applyFormToUI() {
  $('rateProfile').value = state.rateProfile;
  $('customRate').value = state.customRate;
  $('customRateWrap').classList.toggle('visible', state.rateProfile === 'custom');
  $('hours').value = state.hours;
  $('people').value = state.people;
  $('risk').value = state.risk;
  $('urgency').value = state.urgency;
  $('payment').value = state.payment;
  $('maintCheck').checked = state.maintCheck;
  $('maintPct').value = state.maintPct;
  $('maintExtra').classList.toggle('visible', state.maintCheck);
  $('currency').value = state.currency;
  $('fxRate').value = state.fxRate;
  $('fxWrap').classList.toggle('visible', state.currency === 'ARS');
  $('badgeCurrency').textContent = state.currency === 'ARS' ? 'precios en ARS' : 'precios en USD';
  $('companyName').value = state.companyName;
  $('companyEmail').value = state.companyEmail;
  $('companyPhone').value = state.companyPhone;
  $('clientName').value = state.clientName;
  $('projectTitle').value = state.projectTitle;
  $('validityDays').value = state.validityDays;
  $('exclusions').value = state.exclusions;
  updateLogoPreview();
}

function renderTypeChips() {
  const el = $('projectTypes');
  el.innerHTML = PROJECT_TYPES.map((t) => {
    const on = state.projectTypes.includes(t.id);
    return `<button type="button" class="type-chip${on ? ' active' : ''}" data-type="${t.id}">${t.label}</button>`;
  }).join('');

  el.querySelectorAll('.type-chip').forEach((btn) => {
    btn.addEventListener('click', () => toggleProjectType(btn.dataset.type));
  });
}

function toggleProjectType(type) {
  const idx = state.projectTypes.indexOf(type);
  if (idx >= 0) {
    if (state.projectTypes.length === 1) {
      showToast('Dejá al menos una categoría seleccionada');
      return;
    }
    state.projectTypes.splice(idx, 1);
  } else {
    state.projectTypes.push(type);
  }
  if (!state.hoursManual) syncHoursFromChecklist();
  renderTypeChips();
  renderRefTables();
  recalc();
  saveState();
}

function renderRefTables() {
  const container = $('refTables');
  container.innerHTML = '';

  state.projectTypes.forEach((type) => {
    const data = REF_TABLES[type];
    if (!data) return;

    const block = document.createElement('div');
    block.className = 'ref-table';
    block.dataset.type = type;

    let html = `<table><thead><tr><th colspan="3">${data.caption}</th></tr></thead><tbody>`;
    data.rows.forEach((row, idx) => {
      const key = checklistKey(type, idx);
      const checked = !!state.checkedItems[key];
      const mid = Math.round(parseHoursRange(row[1]));
      html += `<tr class="check-row${checked ? ' checked' : ''}" data-type="${type}" data-idx="${idx}">
        <td style="width:32px"><input type="checkbox" data-type="${type}" data-idx="${idx}" ${checked ? 'checked' : ''}></td>
        <td>${row[0]}</td>
        <td class="hrs">${row[1]} <span style="color:var(--text-faint);font-size:11px">(~${mid})</span></td>
      </tr>`;
    });
    html += '</tbody></table>';
    block.innerHTML = html;
    container.appendChild(block);

    block.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleCheckItem(cb.dataset.type, parseInt(cb.dataset.idx, 10));
      });
    });
    block.querySelectorAll('.check-row').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') return;
        toggleCheckItem(tr.dataset.type, parseInt(tr.dataset.idx, 10));
      });
    });
  });

  updateChecklistSum();
  renderCustomItems();
  updateHoursNote();
}

function updateChecklistSum() {
  $('checklistSum').innerHTML =
    `Seleccionados: <b>${getChecklistHours()} hs</b>` +
    (state.hoursManual ? ' · <button type="button" class="sync-link" id="syncHours">Sincronizar con checklist</button>' : '');

  const syncBtn = $('syncHours');
  if (syncBtn) syncBtn.addEventListener('click', () => { syncHoursFromChecklist(); recalc(); });
}

function toggleCheckItem(type, idx) {
  const key = checklistKey(type, idx);
  state.checkedItems[key] = !state.checkedItems[key];
  if (!state.hoursManual) syncHoursFromChecklist();
  renderRefTables();
  recalc();
  saveState();
}

function renderCustomItems() {
  const container = $('customItemsList');
  container.innerHTML = '';
  state.customItems.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'custom-item';
    div.innerHTML = `
      <input type="text" placeholder="Descripción" value="${esc(item.desc)}" data-field="desc" data-idx="${idx}">
      <input type="number" min="1" step="1" value="${item.hours}" data-field="hours" data-idx="${idx}">
      <button type="button" class="btn-icon" data-remove="${idx}" title="Quitar">×</button>`;
    container.appendChild(div);
  });

  container.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('input', () => {
      const i = parseInt(inp.dataset.idx, 10);
      state.customItems[i][inp.dataset.field] = inp.value;
      if (!state.hoursManual) syncHoursFromChecklist();
      updateChecklistSum();
      recalc();
      saveState();
    });
  });
  container.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.customItems.splice(parseInt(btn.dataset.remove, 10), 1);
      if (!state.hoursManual) syncHoursFromChecklist();
      renderRefTables();
      recalc();
      saveState();
    });
  });
}

function esc(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function updateLogoPreview() {
  const preview = $('logoPreview');
  const removeBtn = $('btnRemoveLogo');
  if (state.logoDataUrl) {
    preview.innerHTML = `<img src="${state.logoDataUrl}" alt="Logo">`;
    preview.classList.add('has-logo');
    removeBtn.style.display = 'inline-block';
  } else {
    preview.innerHTML = '<span>Sin logo</span>';
    preview.classList.remove('has-logo');
    removeBtn.style.display = 'none';
  }
}

async function handleLogoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Subí un archivo de imagen (PNG, JPG, SVG…)'); return;
  }
  try {
    state.logoDataUrl = await resizeLogo(file);
    updateLogoPreview();
    saveState();
    showToast('Logo cargado');
  } catch {
    showToast('No se pudo procesar la imagen');
  }
  e.target.value = '';
}

function recalc() {
  readForm();
  const fx = state.currency === 'ARS' ? parseFloat(state.fxRate) || 1 : 1;
  const f = (n) => fmtMoney(n, state.currency, fx);
  const result = calculate(state);

  $('outHours').textContent = result.hours.toLocaleString('en-US') + ' hs';
  $('outRate').textContent = f(result.rate) + '/hora';
  $('outSubtotal').textContent = f(result.subtotal);

  const riskLabel = $('risk').selectedOptions[0].text.split('—')[0].trim().toLowerCase();
  $('outRiskLabel').textContent = `+ riesgo (${riskLabel} ${Math.round(result.riskPct * 100)}%)`;
  $('outRiskVal').textContent = f(result.riskVal);

  const urgLabel = $('urgency').selectedOptions[0].text.split('—')[0].trim().toLowerCase();
  $('outUrgLabel').textContent = `+ urgencia (${urgLabel})`;
  $('outUrgVal').textContent = f(result.urgVal);

  const payLine = $('outPayLine');
  if (result.payPct === 0) {
    payLine.className = 't-line';
    $('outPayLabel').textContent = 'forma de pago (estándar)';
    $('outPayVal').textContent = f(0);
  } else if (result.payPct < 0) {
    payLine.className = 't-line sub';
    $('outPayLabel').textContent = `– descuento adelanto (${Math.round(result.payPct * 100)}%)`;
    $('outPayVal').textContent = f(result.payVal);
  } else {
    payLine.className = 't-line add';
    $('outPayLabel').textContent = `+ recargo por plazo de pago (${Math.round(result.payPct * 100)}%)`;
    $('outPayVal').textContent = f(result.payVal);
  }

  $('outTotal').textContent = f(result.total);
  $('outMin').textContent = f(result.min);
  $('outMid').textContent = f(result.total);
  $('outMax').textContent = f(result.max);
  $('outPeopleN').textContent = result.people;
  $('outPerPerson').textContent = f(result.perPerson);

  const maintLine = $('outMaintLine');
  if (state.maintCheck) {
    maintLine.style.display = 'flex';
    $('outMaint').textContent = f(result.maintMonthly);
  } else {
    maintLine.style.display = 'none';
  }

  saveState();
  return result;
}

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function copyQuote() {
  readForm();
  const result = calculate(state);
  const text = buildQuoteText(state, result, {
    projectType: getProjectTypesLabel(),
    lineItems: collectLineItems(state),
  });
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('btnCopy');
    btn.textContent = '✓ Copiado';
    btn.classList.add('copied');
    showToast('Presupuesto copiado al portapapeles');
    setTimeout(() => {
      btn.textContent = 'Copiar texto';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => showToast('No se pudo copiar'));
}

function exportPdf() {
  readForm();
  const result = calculate(state);
  const ok = openProposalPrint(state, result, { projectTypes: getProjectTypesLabel() });
  if (ok) showToast('Elegí "Guardar como PDF" en el diálogo de impresión');
}

function resetForm() {
  if (!confirm('¿Resetear todo? Se pierde el formulario y el logo guardado.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LOGO_KEY);
  location.reload();
}

function bindEvents() {
  $('rateProfile').addEventListener('change', function () {
    $('customRateWrap').classList.toggle('visible', this.value === 'custom');
    recalc();
  });

  $('maintCheck').addEventListener('change', function () {
    $('maintExtra').classList.toggle('visible', this.checked);
    recalc();
  });

  $('currency').addEventListener('change', function () {
    $('fxWrap').classList.toggle('visible', this.value === 'ARS');
    $('badgeCurrency').textContent = this.value === 'ARS' ? 'precios en ARS' : 'precios en USD';
    recalc();
  });

  $('hours').addEventListener('input', function () {
    state.hoursManual = true;
    updateHoursNote();
    recalc();
  });

  ['customRate', 'people', 'risk', 'urgency', 'payment', 'maintPct', 'fxRate',
    'companyName', 'companyEmail', 'companyPhone', 'clientName', 'projectTitle',
    'validityDays', 'exclusions'].forEach((id) => {
    $(id).addEventListener('input', recalc);
    $(id).addEventListener('change', recalc);
  });

  $('btnAddCustom').addEventListener('click', () => {
    state.customItems.push({ desc: '', hours: '8' });
    if (!state.hoursManual) syncHoursFromChecklist();
    renderRefTables();
    recalc();
    saveState();
  });

  $('logoInput').addEventListener('change', handleLogoUpload);
  $('btnRemoveLogo').addEventListener('click', () => {
    state.logoDataUrl = '';
    updateLogoPreview();
    saveState();
    showToast('Logo quitado');
  });

  $('btnCopy').addEventListener('click', copyQuote);
  $('btnExportPdf').addEventListener('click', exportPdf);
  $('btnReset').addEventListener('click', resetForm);
}

function init() {
  loadState();
  applyFormToUI();
  bindEvents();
  renderTypeChips();
  renderRefTables();
  recalc();
}

init();
