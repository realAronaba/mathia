"use client";

import { FormEvent, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type Overview = { profiles: number; sessions: number; attempts: number; active_consents: number };

async function api<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `Erreur API (${response.status})`);
  return payload as T;
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sourceId, setSourceId] = useState("programme-fractions-4e");
  const [schoolLevel, setSchoolLevel] = useState("4e");
  const [skillId, setSkillId] = useState("add-unlike");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function signInDemo() {
    setBusy(true); setError(""); setMessage("");
    try {
      const session = await api<{ access_token: string }>("/api/v1/auth/demo-token", { method: "POST", body: JSON.stringify({ role: "admin" }) });
      const metrics = await api<Overview>("/api/v1/admin/overview", {}, session.access_token);
      setToken(session.access_token); setOverview(metrics); setMessage("Session administrateur de démonstration ouverte.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’ouvrir l’espace admin."); }
    finally { setBusy(false); }
  }

  async function refresh() {
    if (!token) return;
    setBusy(true); setError("");
    try { setOverview(await api<Overview>("/api/v1/admin/overview", {}, token)); setMessage("Indicateurs actualisés."); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible d’actualiser les indicateurs."); }
    finally { setBusy(false); }
  }

  async function publishCurriculum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api<{ source_id: string; indexed: boolean }>("/api/v1/admin/curriculum/chunks", {
        method: "POST", body: JSON.stringify({ source_id: sourceId, school_level: schoolLevel, skill_id: skillId, content }),
      }, token);
      setMessage(`Contenu ${result.source_id} enregistré. ${result.indexed ? "Embeddings indexés." : "Sans embedding : il sera conservé, le RAG utilisera le contexte de secours."}`);
      setContent("");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’enregistrer ce contenu."); }
    finally { setBusy(false); }
  }

  return <main className="atelier-shell"><div className="atelier-wrap">
    <a className="atelier-back" href="/">← Retour à MathIA</a>
    <header className="atelier-header"><span className="eyebrow">ESPACE ADMINISTRATEUR</span><h1>Supervision MathIA</h1><p>Suivre les volumes du MVP et ajouter des ressources pédagogiques au catalogue serveur.</p></header>
    <section className="atelier-card"><h2>Accès de démonstration</h2><p>Ce bouton n’est disponible qu’en environnement local avec l’authentification démo activée.</p><button className="atelier-button" disabled={busy} onClick={signInDemo}>{token ? "Reconnecter l’admin démo" : "Ouvrir l’espace admin démo"}</button></section>
    {overview && token && <>
      <section className="atelier-card"><div className="admin-heading"><div><h2>Vue d’ensemble</h2><p>Indicateurs agrégés depuis PostgreSQL.</p></div><button className="atelier-button secondary" disabled={busy} onClick={refresh}>Actualiser</button></div>
        <div className="admin-metrics"><article><strong>{overview.profiles}</strong><span>Profils</span></article><article><strong>{overview.active_consents}</strong><span>Consentements actifs</span></article><article><strong>{overview.sessions}</strong><span>Séances</span></article><article><strong>{overview.attempts}</strong><span>Tentatives</span></article></div>
      </section>
      <section className="atelier-card"><h2>Ajouter une ressource de programme</h2><p>Le contenu est enregistré pour le RAG. Un embedding de 1 536 dimensions pourra être fourni par un flux d’ingestion configuré.</p>
        <form className="admin-form" onSubmit={publishCurriculum}>
          <label>Identifiant de source<input value={sourceId} onChange={(e) => setSourceId(e.target.value)} minLength={2} maxLength={120} required /></label>
          <label>Niveau<select value={schoolLevel} onChange={(e) => setSchoolLevel(e.target.value)}><option value="5e">5e</option><option value="4e">4e</option><option value="3e">3e</option></select></label>
          <label>Compétence<input value={skillId} onChange={(e) => setSkillId(e.target.value)} minLength={2} maxLength={80} required /></label>
          <label className="admin-content">Extrait pédagogique<textarea value={content} onChange={(e) => setContent(e.target.value)} minLength={30} maxLength={6000} rows={5} required placeholder="Saisis une explication du programme d’au moins 30 caractères." /></label>
          <button className="atelier-button" disabled={busy || content.trim().length < 30}>{busy ? "Enregistrement…" : "Enregistrer la ressource"}</button>
        </form>
      </section>
    </>}
    {message && <p className="atelier-message" role="status">{message}</p>}
    {error && <p className="atelier-message error" role="alert">{error}</p>}
    <p className="offline-note">L’authentification Clerk/Supabase n’est pas encore reliée à l’interface. Les indicateurs et l’ingestion appellent l’API FastAPI avec un rôle admin démo.</p>
  </div></main>;
}
