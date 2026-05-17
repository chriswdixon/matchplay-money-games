import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  /** Path including leading slash, e.g. "/privacy" */
  path: string;
}

const SITE_ORIGIN = "https://www.match-play.co";

function upsertMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Set per-route title, meta description, canonical, and Open Graph tags.
 * Falls back to defaults from index.html for crawlers that don't execute JS.
 */
export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    const url = `${SITE_ORIGIN}${path}`;
    document.title = title;
    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertCanonical(url);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", url);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  }, [title, description, path]);
}
