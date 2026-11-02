import "server-only"

import { Redis } from "@upstash/redis"

const USED_TTL_SECONDS = 600

let redis: Redis | null | undefined
// Local-only fallback when no Redis is configured. Never used in production.
const devUsed = new Map<string, number>()

function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const configured =
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  if (configured) {
    redis = Redis.fromEnv()
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("Upstash Redis is not configured")
  } else {
    console.warn("Upstash Redis is not configured; using in-memory store")
    redis = null
  }
  return redis
}

// Returns true the first time a ticket is seen, false on reuse.
export async function markTicketUsed(ticket: string): Promise<boolean> {
  const key = `used:${ticket}`
  const client = getRedis()
  if (client) {
    const result = await client.set(key, 1, { nx: true, ex: USED_TTL_SECONDS })
    return result === "OK"
  }

  const now = Date.now()
  const expiresAt = devUsed.get(key)
  if (expiresAt && expiresAt > now) return false
  devUsed.set(key, now + USED_TTL_SECONDS * 1000)
  return true
}
