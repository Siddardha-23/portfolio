import { useEffect } from 'react';

/**
 * Dependency-free per-route SEO manager.
 *
 * The static index.html already carries the canonical home-page metadata and a
 * crawlable pre-render fallback (for crawlers that do NOT run JavaScript). This
 * hook keeps the title/description accurate for crawlers that DO run JS (Google,
 * some LLM crawlers) and for anyone who shares a deep link, by updating the
 * document head when a route mounts.
 */

const SITE_URL = 'https://manneharshithsiddardha.com';

export interface SeoOptions {
  title: string;
  description: string;
  /** Path only, e.g. "/home". Combined with SITE_URL for canonical + og:url. */
  path?: string;
  /** Absolute or site-relative image URL for social cards. */
  image?: string;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useSeo({ title, description, path = '/', image }: SeoOptions) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    const img = image
      ? image.startsWith('http')
        ? image
        : `${SITE_URL}${image}`
      : `${SITE_URL}/og-card.png`;

    document.title = title;

    setMeta('meta[name="description"]', 'name', 'description', description);
    setLink('canonical', url);

    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', url);
    setMeta('meta[property="og:image"]', 'property', 'og:image', img);

    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', img);
  }, [title, description, path, image]);
}
