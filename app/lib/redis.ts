import { Redis } from "@upstash/redis";

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error(
    "Missing UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL/KV_REST_API_TOKEN)",
  );
}

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

export const MESSAGE_TTL_SECONDS = Number(
  process.env.MESSAGE_TTL_SECONDS ?? "1800",
);
