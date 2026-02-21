import { API_URL } from "@nosis/lib/auth-client";
import type { UIMessage } from "ai";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;
const WHITESPACE_RE = /\s/;

const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type ConversationExecutionTarget = "default" | "sandbox";
export type WorkspaceKind = "cloud";
export type WorkspaceStatus = "ready" | "provisioning" | "error";

export interface Office {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  office_id: string | null;
  repo_url: string;
  owner: string;
  repo: string;
  default_branch: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  user_id: string;
  project_id: string;
  kind: WorkspaceKind;
  name: string;
  base_branch: string;
  working_branch: string;
  remote_url: string | null;
  local_path: string | null;
  status: WorkspaceStatus;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  letta_agent_id: string | null;
  execution_target: ConversationExecutionTarget;
  office_id: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  state: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  default_branch: string;
  updated_at: string;
}

export interface GithubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export interface GithubCheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface GithubPullRequestDetail extends GithubPullRequest {
  additions: number;
  deletions: number;
  changed_files: number;
  body: string | null;
}

export interface GithubPullRequestDetailResponse {
  pr: GithubPullRequestDetail;
  check_runs: GithubCheckRun[];
}

export function assertUuid(value: string, field = "ID"): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
}

function assertPathSegment(value: string, field: string): void {
  if (!value || value.length > 200) {
    throw new Error(`Invalid ${field}`);
  }
  if (!PATH_SEGMENT_RE.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
}

function assertBranchName(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 255 || WHITESPACE_RE.test(trimmed)) {
    throw new Error(`Invalid ${field}`);
  }
  return trimmed;
}

function safePagination(
  limit: number,
  offset: number,
  maxLimit = 200
): { limit: number; offset: number } {
  return {
    limit: Math.max(1, Math.min(Math.floor(limit), maxLimit)),
    offset: Math.max(0, Math.floor(offset)),
  };
}

async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const signal = options?.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  const headers = new Headers(options?.headers);
  if (options?.body !== undefined && options.body !== null) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(408, "Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body: unknown = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    const isErrorObj =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as Record<string, unknown>).error === "string";
    const message = isErrorObj
      ? (body as { error: string }).error
      : "Request failed";
    throw new ApiError(response.status, message);
  }

  return response;
}

export async function createConversation(options?: {
  title?: string;
  executionTarget?: ConversationExecutionTarget;
  workspaceId?: string;
  officeId?: string;
}): Promise<Conversation> {
  if (options?.workspaceId) {
    assertUuid(options.workspaceId, "workspace ID");
  }
  if (options?.officeId) {
    assertUuid(options.officeId, "office ID");
  }
  const response = await apiFetch("/api/conversations", {
    method: "POST",
    body: JSON.stringify({
      title: options?.title,
      execution_target: options?.executionTarget,
      office_id: options?.officeId,
      workspace_id: options?.workspaceId,
    }),
  });
  return (await response.json()) as Conversation;
}

export async function listConversations(
  limit = 50,
  offset = 0,
  executionTarget?: ConversationExecutionTarget,
  workspaceId?: string,
  officeId?: string
): Promise<Conversation[]> {
  const page = safePagination(limit, offset);
  const targetQuery = executionTarget
    ? `&execution_target=${encodeURIComponent(executionTarget)}`
    : "";
  const workspaceQuery = workspaceId
    ? `&workspace_id=${encodeURIComponent(workspaceId)}`
    : "";
  const officeQuery = officeId
    ? `&office_id=${encodeURIComponent(officeId)}`
    : "";
  const response = await apiFetch(
    `/api/conversations?limit=${page.limit}&offset=${page.offset}${targetQuery}${workspaceQuery}${officeQuery}`
  );
  return (await response.json()) as Conversation[];
}

export async function getConversation(id: string): Promise<Conversation> {
  assertUuid(id, "conversation ID");
  const response = await apiFetch(`/api/conversations/${id}`);
  return (await response.json()) as Conversation;
}

export async function listConversationMessages(
  conversationId: string,
  limit = 200,
  offset = 0
): Promise<ConversationMessage[]> {
  assertUuid(conversationId, "conversation ID");
  const page = safePagination(limit, offset, 500);
  const response = await apiFetch(
    `/api/conversations/${conversationId}/messages?limit=${page.limit}&offset=${page.offset}`
  );
  return (await response.json()) as ConversationMessage[];
}

export async function setConversationExecutionTarget(
  conversationId: string,
  executionTarget: ConversationExecutionTarget
): Promise<void> {
  assertUuid(conversationId, "conversation ID");
  await apiFetch(`/api/conversations/${conversationId}/execution-target`, {
    method: "PATCH",
    body: JSON.stringify({ execution_target: executionTarget }),
  });
}

export async function setConversationWorkspace(
  conversationId: string,
  workspaceId: string | null
): Promise<void> {
  assertUuid(conversationId, "conversation ID");
  if (workspaceId !== null) {
    assertUuid(workspaceId, "workspace ID");
  }
  await apiFetch(`/api/conversations/${conversationId}/workspace`, {
    method: "PATCH",
    body: JSON.stringify({ workspace_id: workspaceId }),
  });
}

export async function createProject(input: {
  repoUrl: string;
  defaultBranch?: string;
  officeId?: string;
}): Promise<Project> {
  if (input.officeId) {
    assertUuid(input.officeId, "office ID");
  }
  const response = await apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      repo_url: input.repoUrl,
      default_branch: input.defaultBranch,
      office_id: input.officeId,
    }),
  });
  return (await response.json()) as Project;
}

export async function listProjects(officeId?: string): Promise<Project[]> {
  if (officeId) {
    assertUuid(officeId, "office ID");
  }
  const query = officeId ? `?office_id=${encodeURIComponent(officeId)}` : "";
  const response = await apiFetch(`/api/projects${query}`);
  return (await response.json()) as Project[];
}

export async function createOffice(input: { name: string }): Promise<Office> {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error("Invalid office name");
  }
  const response = await apiFetch("/api/offices", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return (await response.json()) as Office;
}

export async function listOffices(): Promise<Office[]> {
  const response = await apiFetch("/api/offices");
  return (await response.json()) as Office[];
}

export async function createWorkspace(input: {
  projectId: string;
  kind: WorkspaceKind;
  name?: string;
  baseBranch?: string;
  workingBranch?: string;
  remoteUrl?: string;
  localPath?: string;
  status?: WorkspaceStatus;
}): Promise<Workspace> {
  assertUuid(input.projectId, "project ID");
  const response = await apiFetch("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({
      project_id: input.projectId,
      kind: input.kind,
      name: input.name,
      base_branch: input.baseBranch,
      working_branch: input.workingBranch,
      remote_url: input.remoteUrl,
      local_path: input.localPath,
      status: input.status,
    }),
  });
  return (await response.json()) as Workspace;
}

export async function listWorkspaces(
  projectId?: string,
  officeId?: string
): Promise<Workspace[]> {
  if (projectId) {
    assertUuid(projectId, "project ID");
  }
  if (officeId) {
    assertUuid(officeId, "office ID");
  }
  const params = new URLSearchParams();
  if (projectId) {
    params.set("project_id", projectId);
  }
  if (officeId) {
    params.set("office_id", officeId);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`/api/workspaces${query}`);
  return (await response.json()) as Workspace[];
}

export async function getWorkspace(id: string): Promise<Workspace> {
  assertUuid(id, "workspace ID");
  const response = await apiFetch(`/api/workspaces/${id}`);
  return (await response.json()) as Workspace;
}

export async function listGithubPullRequests(
  owner: string,
  repo: string,
  limit = 30,
  offset = 0
): Promise<GithubPullRequest[]> {
  assertPathSegment(owner, "repository owner");
  assertPathSegment(repo, "repository name");
  const page = safePagination(limit, offset, 100);
  const response = await apiFetch(
    `/api/github/repos/${owner}/${repo}/pulls?limit=${page.limit}&offset=${page.offset}`
  );
  return (await response.json()) as GithubPullRequest[];
}

export async function listGithubRepos(
  limit = 30,
  offset = 0,
  affiliation?: string
): Promise<GithubRepo[]> {
  const page = safePagination(limit, offset, 100);
  const affiliationQuery = affiliation
    ? `&affiliation=${encodeURIComponent(affiliation)}`
    : "";
  const response = await apiFetch(
    `/api/github/repos?limit=${page.limit}&offset=${page.offset}${affiliationQuery}`
  );
  return (await response.json()) as GithubRepo[];
}

export async function listGithubBranches(
  owner: string,
  repo: string,
  limit = 30,
  offset = 0
): Promise<GithubBranch[]> {
  assertPathSegment(owner, "repository owner");
  assertPathSegment(repo, "repository name");
  const page = safePagination(limit, offset, 100);
  const response = await apiFetch(
    `/api/github/repos/${owner}/${repo}/branches?limit=${page.limit}&offset=${page.offset}`
  );
  return (await response.json()) as GithubBranch[];
}

export async function createGithubBranch(
  owner: string,
  repo: string,
  input: {
    name: string;
    from: string;
  }
): Promise<GithubBranch> {
  assertPathSegment(owner, "repository owner");
  assertPathSegment(repo, "repository name");
  const name = assertBranchName(input.name, "branch name");
  const from = assertBranchName(input.from, "base branch");
  const response = await apiFetch(
    `/api/github/repos/${owner}/${repo}/branches`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        from,
      }),
    }
  );
  return (await response.json()) as GithubBranch;
}

export async function getGithubPullRequestDetail(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<GithubPullRequestDetailResponse> {
  assertPathSegment(owner, "repository owner");
  assertPathSegment(repo, "repository name");
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) {
    throw new Error("Invalid pull request number");
  }
  const response = await apiFetch(
    `/api/github/repos/${owner}/${repo}/pulls/${pullNumber}`
  );
  return (await response.json()) as GithubPullRequestDetailResponse;
}

export async function createGithubPullRequest(
  owner: string,
  repo: string,
  input: {
    title: string;
    head: string;
    base: string;
    body?: string;
  }
): Promise<GithubPullRequest> {
  assertPathSegment(owner, "repository owner");
  assertPathSegment(repo, "repository name");
  const title = input.title.trim();
  if (!title || title.length > 255) {
    throw new Error("Invalid pull request title");
  }
  const head = assertBranchName(input.head, "head branch");
  const base = assertBranchName(input.base, "base branch");
  const body = input.body?.trim();
  const response = await apiFetch(`/api/github/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title,
      head,
      base,
      body: body && body.length > 0 ? body : undefined,
    }),
  });
  return (await response.json()) as GithubPullRequest;
}

export function toUiMessages(messages: ConversationMessage[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [
      {
        type: "text",
        text: message.content,
      },
    ],
  }));
}

export function conversationChatPath(conversationId: string): string {
  assertUuid(conversationId, "conversation ID");
  return `${API_URL}/api/conversations/${conversationId}/chat`;
}
