import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { App } from "./App";

if (new URLSearchParams(window.location.search).get("embed") === "portal") {
  enablePortalEmbed();
}

type PortalDemoStatusVariant = "ready" | "pending" | "error" | "live";

const portalDemoStatusMessageType = "tavus:starter-kit-demo-status";

function getPortalDemoStatusVariant(statusElement: Element): PortalDemoStatusVariant {
  if (statusElement.classList.contains("lobby-header__status--ready")) return "ready";
  if (statusElement.classList.contains("lobby-header__status--error")) return "error";
  if (statusElement.classList.contains("lobby-header__status--live")) return "live";
  return "pending";
}

function postPortalDemoStatus() {
  const statusElement = document.querySelector(".lobby-header__status");
  const label = statusElement?.textContent?.replace(/\s+/g, " ").trim();

  if (!statusElement || !label || window.parent === window) return;

  window.parent.postMessage(
    {
      type: portalDemoStatusMessageType,
      label,
      variant: getPortalDemoStatusVariant(statusElement),
    },
    "*"
  );
}

function enablePortalEmbed() {
  document.documentElement.dataset.portalEmbed = "true";

  const observer = new MutationObserver(() => postPortalDemoStatus());
  const startObserver = () => {
    postPortalDemoStatus();
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
      characterData: true,
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    return;
  }

  queueMicrotask(startObserver);
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
