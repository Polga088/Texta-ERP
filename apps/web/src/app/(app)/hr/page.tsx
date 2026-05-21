"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Department, Employee, LeaveRequest } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [orgChart, setOrgChart] = useState<{ nodes: { id: string; job_title: string; manager_id: string | null }[] } | null>(null);

  useEffect(() => {
    api<Employee[]>("/hr/employees").then(setEmployees).catch(console.error);
    api<Department[]>("/hr/departments").then(setDepartments).catch(console.error);
    api<LeaveRequest[]>("/hr/leave-requests").then(setLeaves).catch(console.error);
    api<{ nodes: { id: string; job_title: string; manager_id: string | null }[] }>("/hr/employees/org-chart")
      .then(setOrgChart)
      .catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">Ressources Humaines</h1>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle className="text-sm text-slate-500">Employés</CardTitle>
          <p className="text-3xl font-bold">{employees.length}</p>
        </Card>
        <Card>
          <CardTitle className="text-sm text-slate-500">Départements</CardTitle>
          <p className="text-3xl font-bold">{departments.length}</p>
        </Card>
        <Card>
          <CardTitle className="text-sm text-slate-500">Congés en attente</CardTitle>
          <p className="text-3xl font-bold">{leaves.filter((l) => l.status === "submitted").length}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Employés</CardTitle>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">Matricule</th>
                <th>Poste</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="py-2">{e.employee_number}</td>
                  <td>{e.job_title}</td>
                  <td>
                    <Badge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardTitle>Organigramme RH</CardTitle>
          <ul className="mt-4 space-y-2 text-sm">
            {orgChart?.nodes.map((n) => (
              <li key={n.id} className="pl-4" style={{ paddingLeft: n.manager_id ? 24 : 0 }}>
                {n.job_title}
                {n.manager_id && <span className="text-slate-400"> ← manager</span>}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Demandes de congés</CardTitle>
          <ul className="mt-4 space-y-2">
            {leaves.map((l) => (
              <li key={l.id} className="flex items-center justify-between border-b py-2 text-sm">
                <span>
                  {l.leave_type} — {l.start_date} → {l.end_date}
                </span>
                <Badge status={l.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
