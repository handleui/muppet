import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "./auth";
import type { Bindings } from "./types";

export interface AuthUser {
  id: string;
  [key: string]: unknown;
}

export interface AuthVariables {
  user: AuthUser | null;
  session: Record<string, unknown> | null;
}

export const sessionMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: AuthVariables;
}>(async (c, next) => {
  const auth = createAuth(c.env);
  const result = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  const rawUser = result?.user;
  if (
    rawUser &&
    typeof rawUser === "object" &&
    typeof rawUser.id === "string"
  ) {
    c.set("user", rawUser as AuthUser);
  } else {
    c.set("user", null);
  }
  c.set("session", result?.session ?? null);
  await next();
});

export const requireAuth = createMiddleware<{
  Bindings: Bindings;
  Variables: AuthVariables;
}>(async (c, next) => {
  if (!c.get("user")) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  await next();
});

/** Extract the authenticated user ID. Must be called after requireAuth. */
export function getUserId(c: { get(key: "user"): AuthUser | null }): string {
  const user = c.get("user");
  if (!user) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  return user.id;
}
