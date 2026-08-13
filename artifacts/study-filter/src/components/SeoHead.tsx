import { useEffect, useRef } from "react";

interface SeoHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  jsonLd?: object;
}

function upsertMeta(
  attrKey: "name" | "property",
  attrValue: string,
  content: string,
) {
  const selector = `meta[${attrKey}="${attrValue}"]`;
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrKey, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function SeoHead({
  title,
  description,
  canonical,
  ogImage,
  jsonLd,
}: SeoHeadProps) {
  const ldScriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const origin = window.location.origin;
    const pageUrl = canonical
      ? `${origin}${canonical}`
      : window.location.href;
    const image = ogImage ?? `${origin}/opengraph.jpg`;

    document.title = title;

    upsertMeta("name", "description", description);

    upsertCanonical(pageUrl);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", pageUrl);
    upsertMeta("property", "og:image", image);

    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    if (jsonLd) {
      if (!ldScriptRef.current) {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo", "");
        document.head.appendChild(script);
        ldScriptRef.current = script;
      }
      ldScriptRef.current.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      if (ldScriptRef.current) {
        ldScriptRef.current.remove();
        ldScriptRef.current = null;
      }
    };
  }, [title, description, canonical, ogImage, jsonLd]);

  return null;
}
