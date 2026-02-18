import {
  createMCPClient,
  auth,
  UnauthorizedError,
  type MCPClient,
} from "@ai-sdk/mcp";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ToolSet } from "ai";
import { createMuppetOAuthProvider } from "./mcp-oauth";

interface McpServer {
  id: string;
  name: string;
  url: string;
  auth_type: string;
}

interface OAuthCodePayload {
  code: string;
  state: string;
}

export interface McpToolsResult {
  tools: ToolSet;
  cleanup: () => Promise<void>;
}

function generateOAuthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function waitForOAuthCode(expectedState: string): Promise<string> {
  let resolveOuter!: (code: string) => void;
  let rejectOuter!: (err: Error) => void;

  const result = new Promise<string>((res, rej) => {
    resolveOuter = res;
    rejectOuter = rej;
  });

  const [unlistenCode, unlistenError] = await Promise.all([
    listen<OAuthCodePayload>("mcp-oauth-code", (event) => {
      unlistenCode?.();
      unlistenError?.();
      if (event.payload.state !== expectedState) {
        rejectOuter(new Error("OAuth state mismatch — possible CSRF attempt"));
        return;
      }
      resolveOuter(event.payload.code);
    }),
    listen<string>("mcp-oauth-error", (event) => {
      unlistenCode?.();
      unlistenError?.();
      rejectOuter(new Error(event.payload));
    }),
  ]);

  return result;
}

async function connectWithApiKey(server: McpServer): Promise<MCPClient> {
  const key = await invoke<string | null>("get_api_key", {
    provider: `mcp:${server.id}`,
  });
  if (!key) {
    throw new Error(`No API key found for MCP server "${server.name}"`);
  }
  return createMCPClient({
    transport: {
      type: "http",
      url: server.url,
      headers: { Authorization: `Bearer ${key}` },
    },
  });
}

async function connectWithOAuth(server: McpServer): Promise<MCPClient> {
  const authProvider = createMuppetOAuthProvider(server.id);

  // Try connecting with cached/refreshed tokens first — no callback server needed
  try {
    return await createMCPClient({
      transport: { type: "http", url: server.url, authProvider },
    });
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) {
      throw err;
    }
  }

  // Cached tokens didn't work — start the OAuth callback server now
  const oauthState = generateOAuthState();
  const port = await invoke<number>("start_oauth_callback_server", {
    expectedState: oauthState,
  });
  authProvider.updateRedirectUrl(`http://127.0.0.1:${port}/oauth/callback`);

  const code = await waitForOAuthCode(oauthState);
  await auth(authProvider, {
    serverUrl: server.url,
    authorizationCode: code,
  });

  return createMCPClient({
    transport: { type: "http", url: server.url, authProvider },
  });
}

async function connectServer(server: McpServer): Promise<MCPClient> {
  switch (server.auth_type) {
    case "api_key":
      return connectWithApiKey(server);
    case "oauth":
      return connectWithOAuth(server);
    default:
      return createMCPClient({
        transport: { type: "http", url: server.url },
      });
  }
}

export async function getActiveTools(): Promise<McpToolsResult> {
  const servers = await invoke<McpServer[]>("list_mcp_servers");
  if (servers.length === 0) {
    return { tools: {}, cleanup: () => Promise.resolve() };
  }

  const clients: MCPClient[] = [];
  const tools: ToolSet = {};

  const results = await Promise.allSettled(
    servers.map(async (server) => {
      const client = await connectServer(server);
      clients.push(client);
      return client.tools();
    })
  );

  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      Object.assign(tools, result.value);
    } else {
      console.warn(`Failed to connect to MCP server "${servers[i].name}"`);
    }
  }

  return {
    tools,
    cleanup: async () => {
      await Promise.allSettled(clients.map((c) => c.close()));
    },
  };
}
