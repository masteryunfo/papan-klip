import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export const MESSAGE_TTL_SECONDS = Number(
  process.env.MESSAGE_TTL_SECONDS ?? "1800",
);
