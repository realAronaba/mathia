"use client";

import { useEffect, useState } from "react";

export default function LegacyApp() {
  const [apiState, setApiState] = useState<"checking" | "online" | "offline">("checking");
  const [lowData, setLowData] = useState(false);

  useEffect(() => {
    void import("../legacy/src/app.js");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const saveData = Boolean(connection?.saveData);
    setLowData(saveData);
    document.body.classList.toggle("low-data-mode", saveData);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const refresh = () => fetch(`${apiBase}/api/v1/health/live`, { cache: "no-store" })
      .then((response) => setApiState(response.ok ? "online" : "offline"))
      .catch(() => setApiState("offline"));
    void refresh();
    const timer = window.setInterval(refresh, 30000);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => { window.clearInterval(timer); document.body.classList.remove("low-data-mode"); };
  }, []);

  const statusText = apiState === "online" ? "API MathIA connectée" : apiState === "offline" ? "API indisponible · parcours démo toujours accessible" : "Connexion à l’API MathIA…";

  return <>
    <div id="app" />
    <div id="modal-root" />
    <div id="toast" className="toast" role="status" aria-live="polite" />
    <div className="runtime-status" data-state={apiState} role="status">
      {statusText}{lowData ? " · Mode texte économe" : ""}
    </div>
    <a className="architecture-launch" href="/atelier">Essayer le parcours guidé API <span aria-hidden="true">→</span></a>
  </>;
}
