import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { HTTPException } from "hono/http-exception";
import { conversations, messages } from "./schema";
import type * as schema from "./schema";
import type { Conversation, Message } from "./types";

export type AppDatabase = DrizzleD1Database<typeof schema>;
export type MessageRole = (typeof messages.$inferInsert)["role"];

function notFound(entity: string): never {
  throw new HTTPException(404, { message: `${entity} not found` });
}

// ── Conversations ──

export async function createConversation(
  db: AppDatabase,
  id: string,
  userId: string,
  title: string
): Promise<Conversation> {
  const row = await db
    .insert(conversations)
    .values({ id, user_id: userId, title })
    .returning()
    .get();

  if (!row) {
    throw new HTTPException(500, {
      message: "Failed to create conversation",
    });
  }
  return row;
}

export function listConversations(
  db: AppDatabase,
  userId: string,
  limit: number,
  offset: number
): Promise<Conversation[]> {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.user_id, userId))
    .orderBy(desc(conversations.updated_at))
    .limit(limit)
    .offset(offset);
}

export async function getConversation(
  db: AppDatabase,
  id: string,
  userId: string
): Promise<Conversation> {
  const row = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.user_id, userId)))
    .get();

  if (!row) {
    notFound("Conversation");
  }
  return row;
}

export async function updateConversationTitle(
  db: AppDatabase,
  id: string,
  userId: string,
  title: string
): Promise<void> {
  const result = await db
    .update(conversations)
    .set({ title, updated_at: sql`datetime('now')` })
    .where(and(eq(conversations.id, id), eq(conversations.user_id, userId)))
    .returning({ id: conversations.id })
    .get();

  if (!result) {
    notFound("Conversation");
  }
}

export async function deleteConversation(
  db: AppDatabase,
  id: string,
  userId: string
): Promise<void> {
  const result = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.user_id, userId)))
    .returning({ id: conversations.id })
    .get();

  if (!result) {
    notFound("Conversation");
  }
}

export async function setConversationAgentId(
  db: AppDatabase,
  id: string,
  userId: string,
  agentId: string
): Promise<void> {
  const result = await db
    .update(conversations)
    .set({ letta_agent_id: agentId, updated_at: sql`datetime('now')` })
    .where(and(eq(conversations.id, id), eq(conversations.user_id, userId)))
    .returning({ id: conversations.id })
    .get();

  if (!result) {
    notFound("Conversation");
  }
}

/** Atomically set agent ID only if not already set. Returns true if this call won. */
export async function trySetConversationAgentId(
  db: AppDatabase,
  id: string,
  userId: string,
  agentId: string
): Promise<boolean> {
  const result = await db
    .update(conversations)
    .set({ letta_agent_id: agentId, updated_at: sql`datetime('now')` })
    .where(
      and(
        eq(conversations.id, id),
        eq(conversations.user_id, userId),
        isNull(conversations.letta_agent_id)
      )
    )
    .returning({ id: conversations.id });
  return result.length > 0;
}

/**
 * Lightweight lookup returning only the agent ID (or null). Throws 404 if not found
 * or not owned by userId.
 */
export async function getConversationAgentId(
  db: AppDatabase,
  id: string,
  userId: string
): Promise<string | null> {
  const row = await db
    .select({ letta_agent_id: conversations.letta_agent_id })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.user_id, userId)))
    .get();

  if (!row) {
    notFound("Conversation");
  }
  return row.letta_agent_id;
}

// ── Messages ──

export async function getMessages(
  db: AppDatabase,
  conversationId: string,
  userId: string,
  limit: number,
  offset: number
): Promise<Message[]> {
  const [convCheck, msgs] = await db.batch([
    db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.user_id, userId)
        )
      ),
    db
      .select()
      .from(messages)
      .where(eq(messages.conversation_id, conversationId))
      .orderBy(asc(messages.created_at))
      .limit(limit)
      .offset(offset),
  ]);

  if (convCheck.length === 0) {
    notFound("Conversation");
  }

  return msgs;
}

export async function saveMessage(
  db: AppDatabase,
  id: string,
  conversationId: string,
  userId: string,
  role: MessageRole,
  content: string,
  model: string | null,
  tokensIn: number,
  tokensOut: number
): Promise<Message> {
  // Verify ownership, touch updated_at, and insert — all in one batch.
  // Avoids an extra getConversation round-trip (D1 FK errors surface as 500, not 404).
  const [convCheck, , inserted] = await db.batch([
    db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.user_id, userId)
        )
      ),
    db
      .update(conversations)
      .set({ updated_at: sql`datetime('now')` })
      .where(eq(conversations.id, conversationId)),
    db
      .insert(messages)
      .values({
        id,
        conversation_id: conversationId,
        role,
        content,
        model,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
      })
      .returning(),
  ]);

  if (convCheck.length === 0) {
    notFound("Conversation");
  }

  const row = inserted[0];
  if (!row) {
    throw new HTTPException(500, { message: "Failed to save message" });
  }
  return row;
}

/** Insert a message without the conversation-existence check. */
export async function saveMessageBatch(
  db: AppDatabase,
  id: string,
  conversationId: string,
  role: MessageRole,
  content: string,
  model: string | null,
  tokensIn: number,
  tokensOut: number
): Promise<Message> {
  const [, inserted] = await db.batch([
    db
      .update(conversations)
      .set({ updated_at: sql`datetime('now')` })
      .where(eq(conversations.id, conversationId)),
    db
      .insert(messages)
      .values({
        id,
        conversation_id: conversationId,
        role,
        content,
        model,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
      })
      .returning(),
  ]);

  const row = inserted[0];
  if (!row) {
    throw new HTTPException(500, { message: "Failed to save message" });
  }
  return row;
}
