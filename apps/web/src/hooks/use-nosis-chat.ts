"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ApiError,
  conversationChatPath,
  listConversationMessages,
  toUiMessages,
} from "@nosis/lib/worker-api";

const HISTORY_RETRY_DELAY_MS = 300;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function toHistoryError(error: unknown): Error {
  if (error instanceof ApiError && error.status >= 500) {
    return new Error(
      "Could not load chat history right now. Please retry in a moment."
    );
  }
  return error instanceof Error
    ? error
    : new Error("Failed to load chat history");
}

export function useNosisChat(conversationId: string) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: conversationChatPath(conversationId),
        credentials: "include",
        prepareSendMessagesRequest: ({ messages }) => {
          const lastMessage = messages.at(-1);
          const textPart = lastMessage?.parts.find((p) => p.type === "text");
          return {
            body: {
              content: textPart?.text ?? "",
            },
          };
        },
      }),
    [conversationId]
  );

  const { setMessages, ...chat } = useChat({
    id: conversationId,
    transport,
  });

  const [isHydratingHistory, setIsHydratingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<Error | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;

    setIsHydratingHistory(true);
    setHistoryError(undefined);
    setMessages([]);

    const loadHistory = async () => {
      try {
        return await listConversationMessages(conversationId);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status < 500) {
          throw error;
        }
      }

      await sleep(HISTORY_RETRY_DELAY_MS);
      return await listConversationMessages(conversationId);
    };

    loadHistory()
      .then((history) => {
        if (cancelled) {
          return;
        }
        setMessages(toUiMessages(history));
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setHistoryError(toHistoryError(err));
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydratingHistory(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, setMessages]);

  return {
    ...chat,
    setMessages,
    isHydratingHistory,
    historyError,
  };
}
