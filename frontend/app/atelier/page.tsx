"use client";

import { FormEvent, useState } from "react";
import MathExpression from "./math-expression";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PIPELINE = ["Filtre d’entrée", "OCR si photo", "Moteur SymPy", "LLM + RAG", "Vérification", "Filtre de sortie"];
type Stage = { stage: string; step: number; can_advance: boolean };
type Session = { id: string; expression: string; stage: Stage };
type Result = { correct: boolean; explanation: string; pipeline: string[]; mastery_probability: number; stage: string; step: number; can_advance: boolean };
type ParentReport = { profile_id: string; pseudonym: string; school_level: string; consent_active: boolean; attempt_count: number; skills: { skill_id: string; mastery_probability: number; evidence_count: number }[] };

async function api<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `Erreur API (${response.status})`);
  return payload as T;
}

export default function AtelierPage() {
  const [exerciseId, setExerciseId] = useState("fraction-add-unlike-01");
  const [answer, setAnswer] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [parentToken, setParentToken] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [parentReport, setParentReport] = useState<ParentReport | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function begin() {
    if (!consentAccepted) { setError("Confirme d’abord l’accord parental de démonstration."); return; }
    setBusy(true); setError(""); setMessage(""); setResult(null);
    try {
      const parent = await api<{ access_token: string }>("/api/v1/auth/demo-token", { method: "POST", body: JSON.stringify({ role: "parent" }) });
      const profile = await api<{ id: string }>("/api/v1/profiles", {
        method: "POST", body: JSON.stringify({ pseudonym: "Élève démo", school_level: "4e", consent_accepted: true, consent_version: "demo-v1" }),
      }, parent.access_token);
      const student = await api<{ access_token: string }>("/api/v1/auth/demo-token", { method: "POST", body: JSON.stringify({ role: "student" }) });
      const created = await api<Session>("/api/v1/tutor/sessions", {
        method: "POST", body: JSON.stringify({ profile_id: profile.id, exercise_id: exerciseId }),
      }, student.access_token);
      setParentToken(parent.access_token); setProfileId(profile.id); setParentReport(null);
      setToken(student.access_token); setSession(created); setMessage("Consentement de démonstration enregistré. La progression de cette séance est pilotée par le serveur.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de démarrer la séance."); }
    finally { setBusy(false); }
  }

  async function loadParentReport() {
    if (!profileId || !parentToken) return;
    setBusy(true); setError("");
    try {
      setParentReport(await api<ParentReport>(`/api/v1/parent/profiles/${profileId}/report`, {}, parentToken));
      setMessage("Le bilan parent a été actualisé depuis les données enregistrées par l’API.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de charger le bilan parent."); }
    finally { setBusy(false); }
  }

  async function revokeConsent() {
    if (!profileId || !parentToken) return;
    setBusy(true); setError("");
    try {
      await api(`/api/v1/parent/profiles/${profileId}/consent/revoke`, { method: "POST" }, parentToken);
      setMessage("Consentement retiré. Le profil élève est maintenant en pause.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de retirer le consentement."); }
    finally { setBusy(false); }
  }

  async function startLearning() {
    if (!session || !token) return;
    setBusy(true); setError("");
    try {
      const updated = await api<Session>(`/api/v1/tutor/sessions/${session.id}/advance`, { method: "POST" }, token);
      setSession(updated); setResult(null); setAnswer(""); setMessage("Étape ouverte par l’orchestrateur pédagogique.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de passer à l’étape suivante."); }
    finally { setBusy(false); }
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session || !token) return;
    setBusy(true); setError("");
    try {
      const photo = (event.currentTarget.elements.namedItem("exercise-photo") as HTMLInputElement | null)?.files?.[0];
      let checked: Result;
      if (photo) {
        const data = new FormData();
        data.append("answer", answer);
        data.append("image", photo);
        checked = await api<Result>(`/api/v1/tutor/sessions/${session.id}/photo-answer`, { method: "POST", body: data }, token);
      } else {
        checked = await api<Result>(`/api/v1/tutor/sessions/${session.id}/answer`, { method: "POST", body: JSON.stringify({ answer }) }, token);
      }
      setResult(checked); setSession({ ...session, stage: { stage: checked.stage, step: checked.step, can_advance: checked.can_advance } });
      setMessage(checked.correct ? "Réponse vérifiée par le moteur déterministe. Tu peux continuer." : "La machine à états conserve l’étape et propose un indice.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de vérifier la réponse."); }
    finally { setBusy(false); }
  }

  return <main className="atelier-shell"><div className="atelier-wrap">
    <a className="atelier-back" href="/">← Retour à l’espace MathIA</a>
    <header className="atelier-header"><span className="eyebrow">PARCOURS PILOTÉ PAR L’API</span><h1>Atelier de fractions</h1><p>Cette séance suit le pipeline séquentiel : le serveur filtre l’entrée, calcule la vérité mathématique puis utilise le tuteur uniquement pour l’explication.</p></header>
    <section className="atelier-card" aria-labelledby="setup-title">
      <h2 id="setup-title">1. Espace parent : créer et autoriser un profil démo</h2>
      <p>Le parcours crée un profil pseudonymisé, consigne un accord de démonstration, puis ouvre une session élève.</p>
      <label className="consent-check"><input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />J’accepte d’enregistrer l’accord parental de démonstration pour ce profil local.</label>
      <div className="atelier-controls"><label>Exercice<select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}><option value="fraction-add-unlike-01">1/2 + 1/3 — dénominateurs différents</option><option value="fraction-add-like-01">2/7 + 3/7 — même dénominateur</option><option value="fraction-equivalent-01">1/2 — fractions équivalentes</option></select></label><button className="atelier-button" disabled={busy || !consentAccepted} onClick={begin}>{busy ? "Préparation…" : session ? "Recommencer le parcours" : "Créer le profil et commencer"}</button></div>
    </section>

    {session && <section className="atelier-card" aria-labelledby="session-title">
      <h2 id="session-title">2. Espace élève : suivre les étapes contrôlées</h2>
      <p>Étape serveur {session.stage.step}/4 · <strong>{session.stage.stage.replaceAll("_", " ")}</strong></p>
      <MathExpression expression={session.expression} />
      {session.stage.stage === "welcome" ? <button className="atelier-button" disabled={busy} onClick={startLearning}>Commencer la séance</button> : session.stage.stage === "complete" ? <p className="atelier-message">Séance terminée. La progression de maîtrise a été enregistrée.</p> : <form className="atelier-controls" onSubmit={submitAnswer}><label>Ta réponse<input value={answer} onChange={(event) => setAnswer(event.target.value)} inputMode="text" autoComplete="off" placeholder="Ex. 5/6" required /></label><label>Photo de l’énoncé (optionnelle)<input name="exercise-photo" type="file" accept="image/jpeg,image/png,image/webp" /></label><button className="atelier-button" disabled={busy}>{busy ? "Vérification…" : "Vérifier avec MathIA"}</button></form>}
      {session.stage.can_advance && session.stage.stage !== "complete" && <button className="atelier-button secondary" disabled={busy} onClick={startLearning}>Étape suivante →</button>}
      {result && <><p className="atelier-message">{result.explanation}</p><p>Maîtrise estimée : {Math.round(result.mastery_probability * 100)}%</p><div className="mastery-track" aria-label={`Maîtrise ${Math.round(result.mastery_probability * 100)}%`}><span style={{ width: `${Math.round(result.mastery_probability * 100)}%` }} /></div><div className="pipeline-list" aria-label="Étapes du pipeline IA">{PIPELINE.map((stage, index) => <div className={`pipeline-step ${result.pipeline[index] ? "done" : ""}`} key={stage}>{index + 1}. {stage}<br />{result.pipeline[index] || "En attente"}</div>)}</div></>}
    </section>}
    {profileId && parentToken && <section className="atelier-card" aria-labelledby="parent-report-title">
      <h2 id="parent-report-title">3. Espace parent : suivre et gérer le profil</h2>
      <p>Le parent peut consulter les tentatives et la maîtrise estimée, puis retirer son consentement à tout moment.</p>
      <div className="atelier-controls"><button className="atelier-button secondary" disabled={busy} onClick={loadParentReport}>Actualiser le bilan</button><button className="atelier-button danger" disabled={busy} onClick={revokeConsent}>Retirer le consentement et mettre en pause</button></div>
      {parentReport && <div className="parent-report"><p><strong>{parentReport.pseudonym}</strong> · niveau {parentReport.school_level} · {parentReport.attempt_count} tentative(s) · consentement {parentReport.consent_active ? "actif" : "retiré"}</p>{parentReport.skills.length ? <ul>{parentReport.skills.map((skill) => <li key={skill.skill_id}>{skill.skill_id} : {Math.round(skill.mastery_probability * 100)}% ({skill.evidence_count} observation(s))</li>)}</ul> : <p>La maîtrise sera estimée après les premières réponses.</p>}</div>}
    </section>}
    {message && <p className="atelier-message" role="status">{message}</p>}
    {error && <p className="atelier-message error" role="alert">{error}</p>}
    <p className="offline-note">Mode démo local : l’authentification fournisseur, les clés OCR et les clés LLM restent désactivées tant qu’elles ne sont pas configurées. Le traitement OCR d’une photo nécessite Mathpix activé côté serveur. La version de démonstration n’utilise aucune donnée d’élève réelle.</p>
  </div></main>;
}
