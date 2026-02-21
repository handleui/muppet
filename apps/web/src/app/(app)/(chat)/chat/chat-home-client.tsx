"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChatInput from "@nosis/components/chat-input";
import { createConversation } from "@nosis/lib/worker-api";

const MAX_TITLE_LENGTH = 80;

function buildConversationTitle(text: string): string {
  return text.trim().slice(0, MAX_TITLE_LENGTH);
}

export default function ChatHomeClient() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isCreating) {
      return;
    }

    setError(null);
    setIsCreating(true);
    const conversation = await createConversation({
      executionTarget: "default",
      title: buildConversationTitle(trimmed),
    }).catch((err) => {
      setError(
        err instanceof Error ? err.message : "Failed to create chat thread"
      );
      return null;
    });
    setIsCreating(false);

    if (conversation) {
      router.push(`/chat/${conversation.id}?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <p className="mb-3 font-medium text-[18px] text-black">New chat</p>
          <ChatInput
            disabled={isCreating}
            onSend={handleSend}
            placeholder="Send a message to start a new thread..."
            submitLabel={isCreating ? "Starting..." : "Send"}
          />
          {error ? <p className="mt-3 text-red-600 text-sm">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
