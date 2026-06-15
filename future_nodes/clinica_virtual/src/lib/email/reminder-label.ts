export function formatReminderLabel(minutesBefore: number): string {
  if (minutesBefore >= 1440 && minutesBefore % 1440 === 0) {
    const days = minutesBefore / 1440;
    return days === 1 ? "1 día antes" : `${days} días antes`;
  }
  if (minutesBefore >= 60 && minutesBefore % 60 === 0) {
    const hours = minutesBefore / 60;
    return hours === 1 ? "1 hora antes" : `${hours} horas antes`;
  }
  return `${minutesBefore} minutos antes`;
}
