import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "profile-pictures";
const SIGN_TTL_SECONDS = 60 * 60; // 1h
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh 5 min before expiry

type CacheEntry = { url: string; expiresAt: number; promise?: Promise<string | null> };
const cache = new Map<string, CacheEntry>();

/**
 * Extract the storage path (e.g. "<uid>/avatar.jpg") from either:
 *  - a stored path "<uid>/avatar.jpg"
 *  - a legacy public URL ".../object/public/profile-pictures/<uid>/avatar.jpg"
 *  - an authenticated/sign URL ".../object/(sign|authenticated)/profile-pictures/<uid>/avatar.jpg"
 * Returns null if not a profile-pictures reference.
 */
export function extractProfilePicturePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.includes("/")) return null;
  if (!value.startsWith("http")) {
    // Already a path
    return value.replace(/^\/+/, "");
  }
  const m = value.match(/\/profile-pictures\/(.+?)(?:\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function signPath(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function getSignedAvatarUrl(stored: string | null | undefined): Promise<string | null> {
  const path = extractProfilePicturePath(stored);
  if (!path) return null;

  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt - REFRESH_BEFORE_MS > now) return cached.url;
  if (cached?.promise) return cached.promise;

  const promise = signPath(path).then((url) => {
    if (url) {
      cache.set(path, { url, expiresAt: now + SIGN_TTL_SECONDS * 1000 });
    } else {
      cache.delete(path);
    }
    return url;
  });
  cache.set(path, { url: cached?.url ?? "", expiresAt: cached?.expiresAt ?? 0, promise });
  return promise;
}

/** React hook: turns a stored avatar reference into a fresh signed URL. */
export function useSignedAvatarUrl(stored: string | null | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => {
    const path = extractProfilePicturePath(stored);
    if (!path) return undefined;
    const cached = cache.get(path);
    return cached && cached.expiresAt > Date.now() ? cached.url : undefined;
  });

  useEffect(() => {
    let active = true;
    const path = extractProfilePicturePath(stored);
    if (!path) {
      setUrl(undefined);
      return;
    }
    getSignedAvatarUrl(stored).then((u) => {
      if (active) setUrl(u ?? undefined);
    });
    return () => {
      active = false;
    };
  }, [stored]);

  return url;
}
