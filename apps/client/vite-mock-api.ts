import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { WebSocketServer } from "ws";

import type { AuthConfig, DemoCataloguePage, Session } from "./src/api-types.ts";
import {
  encodeLiveSnapshot,
  livePath,
  parseLivePath,
} from "@agent-starter/live";
import { randomUUID } from "node:crypto";

interface StoredUser {
  userId: string;
  email: string;
  password: string;
  displayName: string;
}

const users = new Map<string, StoredUser>();
const sessions = new Map<string, Session>();

function problem(
  status: number,
  code: string,
  detail: string,
  requestId = randomUUID(),
) {
  return {
    type: "about:blank",
    title: code,
    status,
    code,
    detail,
    requestId,
  };
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sessionCookie(session: Session): string {
  const token = randomUUID();
  sessions.set(token, session);
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

function sessionFromRequest(req: IncomingMessage): Session | null {
  const cookie = req.headers.cookie ?? "";
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  if (!match) {
    return null;
  }
  return sessions.get(match[1] ?? "") ?? null;
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  for (const [key, value] of Object.entries(headers ?? {})) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(body));
}

let liveRevision = 1;
const liveData: Record<string, Record<string, unknown>> = {
  [livePath({ kind: "session" })]: {},
  [livePath({ kind: "demo-catalogue" })]: {
    items: [
      {
        id: "demo_1",
        title: "Welcome",
        summary: "Replace this catalogue with your own live scope.",
      },
    ],
  } satisfies DemoCataloguePage as unknown as Record<string, unknown>,
};

function syncLiveSession(session: Session | null): void {
  if (session) {
    liveData[livePath({ kind: "session" })] = session as unknown as Record<string, unknown>;
  } else {
    liveData[livePath({ kind: "session" })] = {};
  }
  liveRevision += 1;
}

export function mockApiPlugin(): Plugin {
  return {
    name: "agent-starter-mock-api",
    configureServer(server: ViteDevServer) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        const scope = parseLivePath(url.pathname);
        if (!scope) {
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          const path = livePath(scope);
          const data = liveData[path] ?? {};
          ws.send(encodeLiveSnapshot(liveRevision, data));
          ws.on("message", (raw) => {
            const text = raw.toString();
            try {
              const frame = JSON.parse(text) as { type?: string };
              if (frame.type === "more") {
                ws.send(encodeLiveSnapshot(liveRevision, liveData[path] ?? {}));
              }
            } catch {
              /* ignore */
            }
          });
        });
      });

      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: mock REST router
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }
        const url = new URL(req.url, "http://127.0.0.1");
        const path = url.pathname;

        if (path === "/auth/config" && req.method === "GET") {
          const config: AuthConfig = {
            turnstileSiteKey: null,
            passwordMinLength: 8,
          };
          sendJson(res, 200, config);
          return;
        }

        if (path === "/v1/session" && req.method === "GET") {
          const session = sessionFromRequest(req);
          if (!session) {
            sendJson(res, 401, problem(401, "UNAUTHENTICATED", "Sign in to continue."));
            return;
          }
          sendJson(res, 200, session);
          return;
        }

        if (path === "/auth/sign-up" && req.method === "POST") {
          const body = (await readJson(req)) as {
            email?: string;
            password?: string;
          };
          if (!body.email || !body.password) {
            sendJson(res, 400, problem(400, "INVALID", "Email and password are required."));
            return;
          }
          if (users.has(body.email)) {
            sendJson(res, 409, problem(409, "CONFLICT", "An account already exists for this email."));
            return;
          }
          const user: StoredUser = {
            userId: `usr_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
            email: body.email,
            password: body.password,
            displayName: body.email.split("@")[0] ?? body.email,
          };
          users.set(body.email, user);
          const session: Session = {
            userId: user.userId,
            email: user.email,
            displayName: user.displayName,
            csrfToken: randomUUID(),
          };
          syncLiveSession(session);
          sendJson(res, 200, session, {
            "set-cookie": sessionCookie(session),
          });
          return;
        }

        if (path === "/auth/sign-in" && req.method === "POST") {
          const body = (await readJson(req)) as {
            email?: string;
            password?: string;
          };
          const user = body.email ? users.get(body.email) : undefined;
          if (!user || user.password !== body.password) {
            sendJson(res, 401, problem(401, "UNAUTHENTICATED", "Email or password is incorrect."));
            return;
          }
          const session: Session = {
            userId: user.userId,
            email: user.email,
            displayName: user.displayName,
            csrfToken: randomUUID(),
          };
          syncLiveSession(session);
          sendJson(res, 200, session, {
            "set-cookie": sessionCookie(session),
          });
          return;
        }

        if (path === "/auth/logout" && req.method === "POST") {
          syncLiveSession(null);
          sendJson(res, 204, undefined, {
            "set-cookie": "session=; Path=/; HttpOnly; Max-Age=0",
          });
          return;
        }

        if (path === "/auth/forgot-password" && req.method === "POST") {
          sendJson(res, 204, undefined);
          return;
        }

        if (path === "/auth/reset-password" && req.method === "POST") {
          sendJson(res, 204, undefined);
          return;
        }

        next();
      });
    },
  };
}
