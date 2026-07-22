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

export const REMINDER_ANTICIPATION_OPTIONS = [
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 720, label: "12 horas antes" },
  { value: 1440, label: "1 día antes" },
  { value: 2880, label: "2 días antes" },
] as const;
