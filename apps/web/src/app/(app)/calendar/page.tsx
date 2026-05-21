"use client";

import { useEffect, useState } from "react";
import { format, parseISO, startOfWeek, addDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { api } from "@/lib/api";
import { CalendarEvent } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    api<CalendarEvent[]>("/calendar/events").then(setEvents).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">Agenda & Réunions</h1>

      <div className="mb-8 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayEvents = events.filter((e) => isSameDay(parseISO(e.start_at), day));
          return (
            <Card key={day.toISOString()} className="min-h-[120px] p-3">
              <p className="text-xs font-semibold text-slate-500">
                {format(day, "EEE d", { locale: fr })}
              </p>
              {dayEvents.map((e) => (
                <div key={e.id} className="mt-2 rounded bg-indigo-50 p-2 text-xs dark:bg-indigo-950">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-slate-500">{format(parseISO(e.start_at), "HH:mm")}</p>
                </div>
              ))}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle>Prochains événements</CardTitle>
        <ul className="mt-4 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex justify-between border-b pb-3 text-sm">
              <div>
                <p className="font-medium">{e.title}</p>
                <p className="text-slate-500">
                  {format(parseISO(e.start_at), "PPp", { locale: fr })}
                  {e.meeting_url && (
                    <a href={e.meeting_url} className="ml-2 text-indigo-600 hover:underline">
                      Rejoindre
                    </a>
                  )}
                </p>
              </div>
              <span className="text-slate-400">{e.attendees?.length || 0} participants</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
