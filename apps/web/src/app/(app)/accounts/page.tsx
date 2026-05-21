"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Account } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    api<Account[]>("/accounts").then(setAccounts).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">Comptes clients</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Card key={a.id}>
            <CardTitle>{a.name}</CardTitle>
            {a.industry && <p className="mt-2 text-sm text-slate-500">{a.industry}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
