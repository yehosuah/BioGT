import { appEnv } from "@/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";
type ConsoleMethod = "debug" | "info" | "warn" | "error";
type LoggerSinkEntry = {
  level: LogLevel;
  message: string;
  context?: unknown;
  error?: unknown;
};

type LoggerSink = (entry: LoggerSinkEntry) => void;

const queryParamPattern = /([?&](?:key|token|access_token|api_key)=)([^&#\s]+)/gi;
const mapboxTokenPattern = /\b(?:pk|sk)\.[A-Za-z0-9._-]{16,}\b/g;
const googleMapsKeyPattern = /\bAIza[0-9A-Za-z\-_]{20,}\b/g;
const arcgisKeyPattern = /\bAAPK[0-9A-Za-z\-_]{20,}\b/g;
const redacted = "[REDACTED]";
const sinks = new Set<LoggerSink>();

const redactSecretsInString = (value: string, secrets: string[]) => {
  let next = value
    .replace(queryParamPattern, `$1${redacted}`)
    .replace(mapboxTokenPattern, redacted)
    .replace(googleMapsKeyPattern, redacted)
    .replace(arcgisKeyPattern, redacted);

  secrets
    .filter((secret) => secret.length > 0)
    .forEach((secret) => {
      next = next.split(secret).join(redacted);
    });

  return next;
};

const getKnownSecrets = () =>
  [appEnv.map.mapboxToken, appEnv.map.googleMapsKey, appEnv.map.arcgisApiKey].filter(
    (value): value is string => Boolean(value)
  );

const sanitizeError = (value: Error, secrets: string[]) => ({
  name: value.name,
  message: redactSecretsInString(value.message, secrets),
  stack:
    appEnv.appEnv === "production" || !value.stack
      ? undefined
      : redactSecretsInString(value.stack, secrets)
});

export const sanitizeForLog = (
  value: unknown,
  options?: {
    secrets?: string[];
  }
): unknown => {
  const secrets = [...getKnownSecrets(), ...(options?.secrets ?? [])];

  if (typeof value === "string") {
    return redactSecretsInString(value, secrets);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (value instanceof Error) {
    return sanitizeError(value, secrets);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForLog(entry, { secrets }));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (/(token|secret|api[_-]?key|access[_-]?token)/i.test(key)) {
          return [key, redacted];
        }

        return [key, sanitizeForLog(entry, { secrets })];
      })
    );
  }

  return redactSecretsInString(String(value), secrets);
};

const shouldEmitConsole = (level: LogLevel) => {
  if (appEnv.appEnv === "test") {
    return false;
  }

  if (level === "debug") {
    return appEnv.appEnv !== "production" || appEnv.map.debug;
  }

  if (level === "info") {
    return appEnv.appEnv !== "production";
  }

  return true;
};

const emit = (level: LogLevel, message: string, context?: unknown, error?: unknown) => {
  const entry = {
    level,
    message: sanitizeForLog(message) as string,
    context: sanitizeForLog(context),
    error: sanitizeForLog(error)
  };

  if (shouldEmitConsole(level)) {
    const method: ConsoleMethod = level === "debug" ? "debug" : level;
    console[method](`[map:${level}] ${entry.message}`, {
      context: entry.context,
      error: entry.error
    });
  }

  sinks.forEach((sink) => sink(entry));
};

export const registerLoggerSink = (sink: LoggerSink) => {
  sinks.add(sink);
  return () => sinks.delete(sink);
};

export const logger = {
  debug(message: string, context?: unknown) {
    emit("debug", message, context);
  },
  info(message: string, context?: unknown) {
    emit("info", message, context);
  },
  warn(message: string, context?: unknown) {
    emit("warn", message, context);
  },
  error(message: string, error?: unknown, context?: unknown) {
    emit("error", message, context, error);
  }
};
