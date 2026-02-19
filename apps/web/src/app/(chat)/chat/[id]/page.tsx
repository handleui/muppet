"use client";

import { useParams } from "next/navigation";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-1 flex-col">
      <div className="scrollbar-hidden flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-muted text-sm">Chat: {id}</p>
        </div>
      </div>
      <div className="border-subtle border-t p-4">
        <div className="mx-auto max-w-2xl">
          <textarea
            className="w-full resize-none rounded-lg border border-subtle bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-foreground"
            placeholder="Message Nosis..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
