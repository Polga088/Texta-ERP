"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChatMessage } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");

  const load = () => api<ChatMessage[]>("/collaboration/messages").then(setMessages).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await api("/collaboration/messages", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    setContent("");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chat équipe</h1>
        <p className="mt-1 text-sm text-slate-500">Communication en temps réel entre users et entités projet.</p>
      </div>
      <Card className="p-0">
        <CardTitle className="border-b border-slate-100 px-4 py-3">Fil de discussion</CardTitle>
        <div className="max-h-[420px] space-y-2 overflow-auto px-4 py-3">
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p>{m.content}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(m.created_at).toLocaleString("fr-FR")}</p>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-slate-500">Aucun message.</p>}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
          <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Écrire un message..." />
          <Button type="submit">Envoyer</Button>
        </form>
      </Card>
    </div>
  );
}
