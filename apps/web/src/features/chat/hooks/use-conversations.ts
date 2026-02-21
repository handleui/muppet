"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SANDBOX_EXECUTION_TARGET } from "@nosis/agent-runtime";
import {
  type Conversation,
  type ConversationExecutionTarget,
  createConversation,
  listConversations,
} from "@nosis/features/chat/api/worker-chat-api";
import { ApiError } from "@nosis/features/shared/api/worker-http-client";

interface UseConversationsOptions {
  executionTarget?: ConversationExecutionTarget;
  workspaceId?: string | null;
  officeId?: string;
}

interface UseConversationsResult {
  conversations: Conversation[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createNewConversation: (options?: {
    title?: string;
    executionTarget?: ConversationExecutionTarget;
    workspaceId?: string | null;
    officeId?: string;
  }) => Promise<Conversation>;
}

function toConversationListError(error: unknown): string {
  if (error instanceof ApiError && error.status >= 500) {
    return "Could not load chats right now. Please refresh in a moment.";
  }
  return error instanceof Error
    ? error.message
    : "Failed to load conversations";
}

export function useConversations(
  options?: UseConversationsOptions
): UseConversationsResult {
  const defaultExecutionTarget =
    options?.executionTarget ?? SANDBOX_EXECUTION_TARGET;
  const defaultWorkspaceId = options?.workspaceId;
  const defaultOfficeId = options?.officeId;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadConversations = useCallback(
    async (showLoading: boolean) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const rows = await listConversations(
          100,
          0,
          defaultExecutionTarget,
          defaultWorkspaceId,
          defaultOfficeId
        );
        if (requestId !== requestIdRef.current) {
          return;
        }
        setConversations(rows);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setError(toConversationListError(err));
      } finally {
        if (showLoading && requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [defaultExecutionTarget, defaultOfficeId, defaultWorkspaceId]
  );

  const refresh = useCallback(async () => {
    await loadConversations(false);
  }, [loadConversations]);

  useEffect(() => {
    loadConversations(true).catch(() => undefined);
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadConversations]);

  const createNewConversation = useCallback(
    async (createOptions?: {
      title?: string;
      executionTarget?: ConversationExecutionTarget;
      workspaceId?: string | null;
      officeId?: string;
    }) => {
      setIsCreating(true);
      setError(null);
      try {
        const conversation = await createConversation({
          title: createOptions?.title,
          executionTarget:
            createOptions?.executionTarget ?? defaultExecutionTarget,
          workspaceId: createOptions?.workspaceId ?? defaultWorkspaceId,
          officeId: createOptions?.officeId ?? defaultOfficeId,
        });
        setConversations((existing) => {
          if (existing.some((item) => item.id === conversation.id)) {
            return existing;
          }
          return [conversation, ...existing];
        });
        return conversation;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create conversation"
        );
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [defaultExecutionTarget, defaultOfficeId, defaultWorkspaceId]
  );

  return {
    conversations,
    isLoading,
    isCreating,
    error,
    refresh,
    createNewConversation,
  };
}
