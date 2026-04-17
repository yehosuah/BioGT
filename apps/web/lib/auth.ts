import { betterAuth } from "better-auth";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { PostgresDialect } from "kysely";

import { getPool } from "@/lib/db";
import { sendAuthEmail } from "@/lib/mail";

const getBaseUrl = () =>
  process.env.BETTER_AUTH_URL ?? process.env.APP_ORIGIN ?? "http://localhost:3000";

const getSecret = () => {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "biogt-local-dev-secret-change-me-please";
  }

  throw new Error("BETTER_AUTH_SECRET is required in production.");
};

const createAuth = () =>
  betterAuth({
    baseURL: getBaseUrl(),
    secret: getSecret(),
    database: new PostgresDialect({
      pool: getPool()
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: "Restablece tu contraseña de BioGT",
          text: `Abre este enlace para restablecer tu contraseña:\n${url}`
        });
      }
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: "Verifica tu correo para colaborar en BioGT",
          text: `Abre este enlace para verificar tu correo:\n${url}`
        });
      }
    },
    plugins: [nextCookies()]
  });

type BetterAuthInstance = ReturnType<typeof createAuth>;

let authInstance: BetterAuthInstance | null = null;

const getAuth = (): BetterAuthInstance => {
  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance;
};

export const auth = new Proxy({} as BetterAuthInstance, {
  get(_target, property, receiver) {
    return Reflect.get(getAuth(), property, receiver);
  }
});

const getRouteHandlers = () => toNextJsHandler(getAuth());

export const authHandler = {
  GET: (request: Request) => getRouteHandlers().GET(request),
  POST: (request: Request) => getRouteHandlers().POST(request),
  PATCH: (request: Request) => getRouteHandlers().PATCH(request),
  PUT: (request: Request) => getRouteHandlers().PUT(request),
  DELETE: (request: Request) => getRouteHandlers().DELETE(request)
};
