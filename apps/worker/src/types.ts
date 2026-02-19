export type SearchType = "neural" | "fast" | "auto" | "deep";

export type SearchCategory =
  | "company"
  | "research paper"
  | "news"
  | "pdf"
  | "github"
  | "tweet"
  | "personal site"
  | "financial report"
  | "people";

export interface ContentOptions {
  text?: boolean;
}

export interface SearchRequest {
  query: string;
  type?: SearchType;
  category?: SearchCategory;
  numResults?: number;
  contents?: ContentOptions;
}

export interface SearchResult {
  title: string | null;
  url: string;
  publishedDate: string | null;
  author: string | null;
  text: string | null;
  highlights: string[] | null;
  score: number | null;
  id: string;
}

export interface SearchResponse {
  results: SearchResult[];
  requestId: string | null;
}

// ── Firecrawl (URL content extraction) ──

export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  markdown: string;
  title: string | null;
  sourceURL: string;
}

// ── Conversations ──

export interface Conversation {
  id: string;
  title: string;
  letta_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Messages ──

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}
