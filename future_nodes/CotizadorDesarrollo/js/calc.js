export function getRate(rateProfile, customRate) {
  if (rateProfile === 'custom') return parseFloat(customRate) || 0;
  return parseFloat(rateProfile) || 0;
}

export function calculate(state) {
  const rate = getRate(state.rateProfile, state.customRate);
  const hours = parseFloat(state.hours) || 0;
  const people = Math.max(1, parseInt(state.people, 10) || 1);
  const riskPct = parseFloat(state.risk) || 0;
  const urgPct = parseFloat(state.urgency) || 0;
  const payPct = parseFloat(state.payment) || 0;

  const subtotal = rate * hours;
  const riskVal = subtotal * riskPct;
  const urgVal = subtotal * urgPct;
  const payVal = subtotal * payPct;
  const total = subtotal + riskVal + urgVal + payVal;

  const maintMonthly =
    state.maintCheck && total > 0
      ? total * ((parseFloat(state.maintPct) || 0) / 100)
      : 0;

  return {
    rate,
    hours,
    people,
    subtotal,
    riskPct,
    riskVal,
    urgPct,
    urgVal,
    payPct,
    payVal,
    total,
    min: total * 0.9,
    max: total * 1.15,
    perPerson: total / people,
    maintMonthly,
  };
}

export function fmtMoney(amount, currency, fxRate = 1) {
  const n = Math.round(amount * fxRate);
  if (currency === 'ARS') {
    return 'ARS ' + n.toLocaleString('es-AR');
  }
  return 'USD ' + n.toLocaleString('en-US');
}

export function buildQuoteText(state, result, labels) {
  const fx = state.currency === 'ARS' ? parseFloat(state.fxRate) || 1 : 1;
  const f = (n) => fmtMoney(n, state.currency, fx);
  const header = state.companyName ? `${state.companyName}\n` : '';
  const lines = [
    header + 'PRESUPUESTO ESTIMATIVO',
    '─'.repeat(32),
  ];

  if (state.clientName) lines.push(`Cliente: ${state.clientName}`);
  if (state.projectTitle) lines.push(`Proyecto: ${state.projectTitle}`);
  lines.push(`Alcance: ${labels.projectType}`);
  lines.push(`Horas estimadas: ${result.hours} hs`);
  lines.push(`Tarifa: ${f(result.rate)}/hora`, '');

  if (labels.lineItems?.length) {
    lines.push('Detalle:');
    labels.lineItems.forEach((item) => {
      lines.push(`  · [${item.category}] ${item.desc} — ${item.hours} hs`);
    });
    lines.push('');
  }

  lines.push(
    `Subtotal: ${f(result.subtotal)}`,
    `+ Riesgo (${Math.round(result.riskPct * 100)}%): ${f(result.riskVal)}`,
    `+ Urgencia (${Math.round(result.urgPct * 100)}%): ${f(result.urgVal)}`,
  );

  if (result.payPct < 0) {
    lines.push(`– Descuento adelanto (${Math.round(result.payPct * 100)}%): ${f(result.payVal)}`);
  } else if (result.payPct > 0) {
    lines.push(`+ Recargo plazo de pago (${Math.round(result.payPct * 100)}%): ${f(result.payVal)}`);
  }

  lines.push('', `TOTAL RECOMENDADO: ${f(result.total)}`, '');
  lines.push(`Rango sugerido:`);
  lines.push(`  Mínimo:  ${f(result.min)}`);
  lines.push(`  Ideal:   ${f(result.total)}`);
  lines.push(`  Premium: ${f(result.max)}`);

  if (state.maintCheck) {
    lines.push('', `Mantenimiento mensual (${state.maintPct}%): ${f(result.maintMonthly)}`);
  }

  lines.push('', `— ${state.companyName || 'Cotizador Interno'}`);
  return lines.join('\n');
}
