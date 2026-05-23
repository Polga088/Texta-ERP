"use client";

import { useEffect, useState } from "react";
import { addDays, format, isSameDay, isToday, parseISO, startOfWeek } from "date-fns";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agenda & Réunions</h1>
        <p className="mt-1 text-sm text-slate-500">Vue semaine modernisée avec focus sur les événements prioritaires.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {days.map((day) => {
          const dayEvents = events.filter((e) => isSameDay(parseISO(e.start_at), day));
          return (
            <Card
              key={day.toISOString()}
              className={`min-h-[150px] border ${isToday(day) ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200"} p-3`}
            >
              <p className={`text-xs font-semibold ${isToday(day) ? "text-indigo-700" : "text-slate-500"}`}>
                {format(day, "EEEE d", { locale: fr })}
              </p>
              {dayEvents.map((e) => (
                <div key={e.id} className="mt-2 rounded-xl border border-indigo-100 bg-white p-2 text-xs shadow-sm">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-slate-500">
                    {format(parseISO(e.start_at), "HH:mm")} - {format(parseISO(e.end_at), "HH:mm")}
                  </p>
                </div>
              ))}
              {dayEvents.length === 0 && <p className="mt-3 text-xs text-slate-400">Aucun événement.</p>}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle>Prochains événements</CardTitle>
        <ul className="mt-4 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-3 border-b pb-3 text-sm">
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
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-500">
                {e.attendees?.length || 0} participants
              </span>
            </li>
          ))}
          {events.length === 0 && <li className="text-sm text-slate-500">Aucun événement planifié.</li>}
        </ul>
      </Card>
    </div>
  );
}
