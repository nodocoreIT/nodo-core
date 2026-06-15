import { useEffect, useState } from "react";
import { useAuth } from "@nodocore/shared-components";
import { TodayAgendaPanel } from "@/features/dashboard/components/today-agenda-panel";
import { PersonalCalendarPanel } from "@/features/dashboard/components/personal-calendar-panel";
import { supabase } from "@/shared/lib/supabase";

export function AgendaPage() {
  const { session } = useAuth();
  const [calendarId, setCalendarId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session?.user.id) return;
    supabase
      .from("profiles")
      .select("google_calendar_id")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        setCalendarId(data?.google_calendar_id ?? undefined);
        setLoaded(true);
      });
  }, [session?.user.id]);

  return (
    <div className="space-y-6 max-w-4xl">
      <TodayAgendaPanel />
      {loaded && <PersonalCalendarPanel calendarId={calendarId} />}
    </div>
  );
}
