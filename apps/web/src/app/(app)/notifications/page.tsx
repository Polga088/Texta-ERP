"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UserNotification } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  const load = () =>
    api<UserNotification[]>("/collaboration/notifications").then(setNotifications).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const markAsRead = async (id: string) => {
    await api(`/collaboration/notifications/${id}/read`, { method: "PATCH" });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">Suivi des actions utilisateurs et entités.</p>
      </div>

      <Card className="p-0">
        <CardTitle className="border-b border-slate-100 px-4 py-3">Boîte de notifications</CardTitle>
        <ul className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">{n.title}</p>
                <p className="text-sm text-slate-600">{n.message}</p>
                <p className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
              </div>
              {!n.is_read && (
                <Button size="sm" variant="secondary" onClick={() => markAsRead(n.id)}>
                  Marquer lu
                </Button>
              )}
            </li>
          ))}
          {notifications.length === 0 && (
            <li className="px-4 py-5 text-sm text-slate-500">Aucune notification disponible.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
