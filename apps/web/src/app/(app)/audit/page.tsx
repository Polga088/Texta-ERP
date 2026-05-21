"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { api } from "@/lib/api";
import { AuditLog } from "@/types";
import { Card } from "@/components/ui/card";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AuditLog[]>("/audit/logs")
      .then(setLogs)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">Journal d&apos;audit</h1>
      {error && <p className="mb-4 text-red-600">{error} (admin requis)</p>}
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Date</th>
              <th>Action</th>
              <th>Ressource</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="py-2">{format(parseISO(log.created_at), "PPp", { locale: fr })}</td>
                <td>{log.action}</td>
                <td>
                  {log.resource_type}
                  {log.resource_id && ` #${log.resource_id.slice(0, 8)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
