import { useEffect } from "react";

const BASE_TITLE = "Plan2Prompt";
const BASE_URL = "https://plan2prompt.replit.app";
const DEFAULT_DESCRIPTION = "Plan2Prompt validates your app idea with multi-AI consensus, generates comprehensive requirements, and produces step-by-step build instructions that connect directly to your IDE via MCP.";

function setMetaTag(name: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

export function usePageTitle(pageTitle?: string, description?: string) {
  useEffect(() => {
    const fullTitle = pageTitle
      ? `${pageTitle} | ${BASE_TITLE}`
      : `${BASE_TITLE} — From Idea to Execution With Control at Every Step`;
    document.title = fullTitle;

    const desc = description || DEFAULT_DESCRIPTION;
    setMetaTag("description", desc);
    setMetaTag("og:title", fullTitle, true);
    setMetaTag("og:description", desc, true);
    setMetaTag("twitter:title", fullTitle);
    setMetaTag("twitter:description", desc);

    const path = window.location.pathname;
    const canonical = path === "/" ? BASE_URL + "/" : BASE_URL + path;
    setCanonical(canonical);
  }, [pageTitle, description]);
}
