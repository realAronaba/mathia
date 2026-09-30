import { CONTENT_ITEMS, DIAGNOSTIC, EXERCISES, SESSION_STAGES, SKILLS, SKILL_BY_ID } from "./catalog.js";
import { isEquivalent } from "./math.js";
import { loadState, saveState, STORAGE_KEY } from "./storage.js";
import { demoTeacher } from "./tutor.js";

let state = loadState();
let toastTimer;
const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");

const freshStudentData = () => ({
  diagnostic: { started: false, complete: false, step: 0, checked: false, answers: {} },
  progress: {}, course: { active: false, complete: false, step: 0, hintLevel: 0, wrongCount: 0, helpUsed: 0 },
  attemptLog: [], alerts: [], stats: { sessions: 0, minutes: 0, lastSessionAt: null },
  completedExerciseIds: [], practice: { skillId: null, feedback: null, hintLevel: 0, answer: "" }
});

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0] || null;
}

function studentData(profile = activeProfile()) {
  if (!profile) return freshStudentData();
  state.students ||= {};
  state.students[profile.id] ||= freshStudentData();
  const data = state.students[profile.id];
  data.diagnostic ||= freshStudentData().diagnostic;
  data.progress ||= {};
  data.course ||= freshStudentData().course;
  data.attemptLog ||= [];
  data.alerts ||= [];
  data.stats ||= { sessions: 0, minutes: 0, lastSessionAt: null };
  data.completedExerciseIds ||= [];
  data.practice ||= { skillId: null, feedback: null, hintLevel: 0, answer: "" };
  return data;
}

function persist() {
  if (!saveState(state)) notify("La sauvegarde locale est indisponible sur ce navigateur.");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function dateLabel(value) {
  if (!value) return "Pas encore";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(value));
}

function todayLabel() {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createProfile(pseudonym, schoolLevel, returnToParent = false) {
  const profile = {
    id: newId(), pseudonym: pseudonym.trim().slice(0, 24), schoolLevel,
    consentAt: new Date().toISOString(), status: "active", dailyLimit: 30
  };
  state.profiles.push(profile);
  state.students[profile.id] = freshStudentData();
  state.activeProfileId = profile.id;
  state.role = returnToParent ? "parent" : "student";
  state.view = returnToParent ? "parent" : "dashboard";
  persist();
  render();
}

function roleForView(view) {
  if (["parent", "tariffs"].includes(view)) return "parent";
  if (view === "admin") return "admin";
  return "student";
}

function setView(view) {
  state.view = view;
  state.role = roleForView(view);
  persist();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function progressEntries(data = studentData()) {
  return SKILLS.map((skill) => ({ skill, ...(data.progress[skill.id] || { status: "Non évalué", score: null }) }));
}

function masteredCount(data = studentData()) {
  return Object.values(data.progress).filter((item) => item?.status === "Maîtrisé").length;
}

function percentage(data = studentData()) {
  return Math.round((masteredCount(data) / SKILLS.length) * 100);
}

function statusClass(status) {
  if (status === "Maîtrisé") return "status-green";
  if (status === "À renforcer") return "status-blue";
  if (status === "Validé" || status === "Publié") return "status-green";
  if (status === "Brouillon") return "status-neutral";
  return "status-blue";
}

function contentStatus(skillId) {
  const item = CONTENT_ITEMS.find((content) => content.id === skillId);
  return state.contentStatuses[skillId] || item?.status || "Brouillon";
}

function isSkillPublished(skillId) {
  return contentStatus(skillId) === "Publié";
}

function renderSetup() {
  return `
    <main class="setup-shell">
      <div class="setup-topline"><a class="brand" href="#" aria-label="MathIA, accueil"><span class="brand-mark"><span>M</span><i></i></span><span class="brand-name">MathIA</span></a><span class="demo-pill">Mode démo · données fictives</span></div>
      <section class="setup-layout">
        <div class="setup-intro">
          <span class="eyebrow"><span class="eyebrow-dot"></span> APPRENDRE À SON RYTHME</span>
          <h1>Les maths, ça se comprend <span>pas à pas.</span></h1>
          <p>Un tuteur qui te guide, t’aide à raisonner et t’encourage à trouver la réponse par toi-même.</p>
          <div class="setup-principles"><span>Comprendre</span><b>→</b><span>Essayer</span><b>→</b><span>Progresser</span></div>
          <div class="setup-illustration" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="fraction-note"><span>1</span><i></i><span>2</span></div><span class="float-spark spark-a">✳</span><span class="float-spark spark-b">+</span><span class="float-spark spark-c">¼</span></div>
        </div>
        <section class="setup-card" aria-labelledby="setup-title">
          <div class="step-label"><span>1</span><span>ESPACE FAMILLE</span></div>
          <h2 id="setup-title">Créons ton profil élève</h2>
          <p class="muted">Un parent ou responsable démarre la démo et donne son accord avant la première séance.</p>
          <form id="profile-form" class="form-stack">
            <label for="pseudonym">Pseudonyme de l’élève</label>
            <input id="pseudonym" name="pseudonym" maxlength="24" placeholder="Ex. Lila ou SuperNova" autocomplete="off" required />
            <small>Choisis un pseudo. N’utilise pas ton nom complet.</small>
            <label for="school-level">Niveau scolaire</label>
            <select id="school-level" name="schoolLevel" required><option value="">Choisir le niveau</option><option>5e</option><option>4e</option><option>3e</option></select>
            <label class="consent-check"><input type="checkbox" name="consent" required /><span>Je suis parent ou responsable légal et j’autorise l’utilisation de ce profil dans cette démonstration.</span></label>
            <div class="privacy-note"><span class="privacy-lock" aria-hidden="true">⌑</span><span>La démo ne demande ni nom réel, ni adresse e-mail, ni photo. Les informations restent dans ce navigateur.</span></div>
            <button class="button button-primary button-wide" type="submit">Créer le profil <span aria-hidden="true">→</span></button>
          </form>
          <p class="tiny-note">Compte, vérification e-mail et consentement légal vérifiable seront ajoutés au service sécurisé.</p>
        </section>
      </section>
      <footer class="setup-footer"><span>MathIA</span><span>Comprendre. Raisonner. Créer.</span><span>Une démo locale</span></footer>
    </main>`;
}

const NAV = {
  student: [
    { section: "APPRENDRE", items: [["dashboard", "Mon espace", "⌂"], ["diagnostic", "Diagnostic", "◉"], ["path", "Mes parcours", "✳"], ["notebook", "Mon cahier", "▤"]] }
  ],
  parent: [
    { section: "FAMILLE", items: [["parent", "Vue d’ensemble", "⌂"], ["tariffs", "Offres", "◇"]] }
  ],
  admin: [
    { section: "PÉDAGOGIE", items: [["admin", "Contenus & alertes", "▣"]] }
  ]
};

const VIEW_LABELS = { dashboard: "Mon espace", diagnostic: "Diagnostic", path: "Mes parcours", "path-detail": "Leçon", practice: "Exercice", session: "Ma séance", notebook: "Mon cahier", parent: "Espace parent", admin: "Contenus & alertes", tariffs: "Offres MathIA" };

function renderSidebar() {
  const profile = activeProfile();
  const groups = NAV[state.role] || NAV.student;
  return `<aside class="sidebar">
    <a class="brand" href="#" data-view="dashboard" aria-label="MathIA, mon espace"><span class="brand-mark"><span>M</span><i></i></span><span class="brand-name">MathIA</span></a>
    <div class="sidebar-profile"><div class="avatar avatar-blue">${esc((profile?.pseudonym || "M").slice(0,1).toUpperCase())}</div><div class="profile-copy"><strong>${esc(profile?.pseudonym || "Élève")}</strong><span>${esc(profile?.schoolLevel || "5e")} · profil démo</span></div><span class="profile-more" aria-hidden="true">⌄</span></div>
    <nav class="side-nav" aria-label="Navigation principale">${groups.map((group) => `<div class="nav-section"><span class="nav-label">${group.section}</span>${group.items.map(([view,label,icon]) => `<button class="nav-link ${state.view === view || (state.view === "path-detail" && view === "path") ? "is-active" : ""}" data-view="${view}" ${state.view === view ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${view === "diagnostic" && !studentData().diagnostic.complete ? '<i class="nav-dot" aria-label="À faire"></i>' : ""}</button>`).join("")}</div>`).join("")}</nav>
    <div class="sidebar-bottom"><div class="daily-goal"><div class="goal-top"><span class="goal-icon">✳</span><span>Petits pas, grands progrès</span></div><p>Une séance à la fois. Tu avances à ton rythme.</p><div class="goal-leaves" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div><button class="sidebar-help" data-action="show-report"><span aria-hidden="true">?</span> Besoin d’aide ?</button><span class="sidebar-version">MATHIA <span>·</span> DÉMO 0.1</span></div>
  </aside>`;
}

function renderTopbar() {
  const roleLabel = { student: "Espace élève", parent: "Espace parent", admin: "Équipe pédagogique" }[state.role];
  const isPaused = activeProfile()?.status === "paused";
  return `<header class="topbar"><div class="topbar-context"><span class="breadcrumb-root">MathIA</span><span class="breadcrumb-slash">/</span><span>${VIEW_LABELS[state.view] || "Mon espace"}</span></div><div class="topbar-actions">${isPaused ? '<span class="pause-tag">Profil en pause</span>' : ""}<span class="demo-pill"><i></i> Mode démo</span><label class="role-select-wrap"><span class="sr-only">Changer de rôle en mode démonstration</span><select id="role-select" aria-label="Changer de rôle en mode démonstration"><option value="student" ${state.role === "student" ? "selected" : ""}>Vue élève</option><option value="parent" ${state.role === "parent" ? "selected" : ""}>Vue parent</option><option value="admin" ${state.role === "admin" ? "selected" : ""}>Vue admin</option></select></label><button class="avatar avatar-green avatar-button" data-view="parent" aria-label="Ouvrir l’espace parent">${esc((activeProfile()?.pseudonym || "M").slice(0,1).toUpperCase())}</button></div></header>`;
}

function progressRing(value, label) {
  return `<div class="progress-ring" style="--progress:${value * 3.6}deg"><div class="ring-inner"><strong>${value}<span>%</span></strong><small>${label}</small></div></div>`;
}

function renderDashboard() {
  const profile = activeProfile(), data = studentData();
  if (profile.status === "paused") return `<section class="paused-card"><div class="paused-icon">Ⅱ</div><span class="eyebrow">ESPACE ÉLÈVE EN PAUSE</span><h1>Ton espace est en pause</h1><p>Demande à ton parent ou responsable de le réactiver pour reprendre ton parcours.</p><button class="button button-secondary" data-view="parent">Aller à l’espace parent <span>→</span></button></section>`;
  const diagnosticDone = data.diagnostic.complete;
  const canStartSession = isSkillPublished("add-like") && isSkillPublished("add-unlike");
  const next = !diagnosticDone ? { label: "Faire mon petit bilan de départ", meta: "Diagnostic · 4 min", view: "diagnostic", icon: "◉" } : data.course.complete ? { label: "Revoir mon cahier", meta: "Dernière séance · fractions", view: "notebook", icon: "▤" } : canStartSession ? { label: "Additionner des fractions", meta: "Séance guidée · 12 min", view: "session", icon: "½" } : { label: "Explorer les leçons disponibles", meta: "L’équipe prépare la suite du parcours", view: "path", icon: "▤" };
  const mastered = masteredCount(data), pc = percentage(data);
  return `<div class="page-heading"><div><span class="eyebrow">${esc(todayLabel())} <span class="eyebrow-dot"></span> ${esc(profile.schoolLevel)}</span><h1>Bonjour, ${esc(profile.pseudonym)} <span class="wave" aria-hidden="true">✳</span></h1><p>Prêt·e à faire un petit pas en maths aujourd’hui ?</p></div><div class="heading-badge"><span class="badge-spark">✳</span><span><b>${data.stats.sessions ? `${data.stats.sessions} séance${data.stats.sessions > 1 ? "s" : ""}` : "À ton rythme"}</b><small>${data.stats.sessions ? "déjà terminée" : "chaque progrès compte"}</small></span></div></div>
  <section class="dashboard-grid"><div class="main-column-content">
    <article class="next-card"><div class="next-card-art" aria-hidden="true"><div class="math-orbit orbit-left"></div><div class="math-orbit orbit-right"></div><div class="math-big-fraction"><span>1</span><i></i><span>2</span></div><span class="art-plus">+</span><span class="art-leaf">✳</span></div><div class="next-copy"><span class="eyebrow"><span class="live-dot"></span> TA PROCHAINE ÉTAPE</span><h2>${next.label}</h2><p>${next.meta} <span class="middot">·</span> avec ton tuteur de maths</p><button class="button button-primary" ${next.view === "session" ? 'data-action="start-session"' : next.view === "diagnostic" ? 'data-action="start-diagnostic"' : `data-view="${next.view}"`}>${next.view === "session" ? (data.course.active ? "Reprendre ma séance" : "Commencer ma séance") : next.view === "diagnostic" ? "Commencer le diagnostic" : next.view === "notebook" ? "Ouvrir mon cahier" : "Voir les leçons"}<span aria-hidden="true">→</span></button></div><div class="next-card-index"><span>01</span><span>/ 08</span></div></article>
    <div class="section-heading"><div><span class="eyebrow">TON PARCOURS</span><h2>Tu progresses à ton rythme</h2></div><button class="text-button" data-view="path">Voir le parcours <span>→</span></button></div>
    <div class="skill-list">${SKILLS.slice(0,4).map((skill) => renderSkillRow(skill, data)).join("")}<button class="skill-more" data-view="path">Découvrir les 6 compétences <span>→</span></button></div>
  </div><aside class="dashboard-aside">
    <article class="progress-card"><div class="aside-card-heading"><div><span class="eyebrow">VUE D’ENSEMBLE</span><h3>Mon parcours</h3></div><span class="mini-icon icon-blue">↗</span></div><div class="progress-card-center">${progressRing(pc,"maîtrisé")}</div><div class="progress-legend"><span><i class="legend-green"></i> Maîtrisé <b>${mastered}</b></span><span><i class="legend-blue"></i> À explorer <b>${SKILLS.length-mastered}</b></span></div><button class="outline-button button-wide" data-view="diagnostic">${diagnosticDone ? "Voir mon diagnostic" : "Découvrir mon niveau"}<span>→</span></button></article>
    <article class="mission-card"><div class="mission-illustration" aria-hidden="true"><div class="mission-page"></div><span>✳</span></div><span class="eyebrow">PETIT DÉFI</span><h3>${canStartSession ? "1/2 + 1/4, ça fait combien ?" : "La suite se prépare."}</h3><p>${canStartSession ? "Prends quelques secondes pour y réfléchir. Ton tuteur est là si tu bloques." : "Une leçon est en cours de validation par l’équipe pédagogique."}</p><button class="text-button" ${canStartSession ? 'data-action="start-session"' : 'data-view="path"'}>${canStartSession ? "Essayer le défi" : "Voir le parcours"} <span>→</span></button></article>
    <div class="safe-note"><span class="safe-icon">⌑</span><p><b>Un espace sans pression.</b><br>Les erreurs nous aident à apprendre. Il n’y a pas de classement.</p></div>
  </aside></section>`;
}

function renderSkillRow(skill, data = studentData(), interactive = true) {
  const item = data.progress[skill.id] || { status: "Non évalué" };
  const icon = { recognize: "¼", compare: "⇄", simplify: "↗", equivalent: "=", "add-like": "+", "add-unlike": "½" }[skill.id];
  const published = isSkillPublished(skill.id), status = interactive && !published ? contentStatus(skill.id) : item.status;
  const subtext = interactive && !published ? "Disponible après publication par l’équipe" : skill.short;
  const content = `<span class="skill-icon ${item.status === "Maîtrisé" ? "skill-green" : "skill-blue"}">${icon}</span><span class="skill-name"><b>${esc(skill.title)}</b><small>${esc(subtext)}</small></span><span class="status-chip ${statusClass(status)}">${esc(status)}</span>${interactive ? `<span class="row-arrow" aria-hidden="true">${published ? "→" : "⌑"}</span>` : ""}`;
  if (!interactive) return `<div class="skill-row">${content}</div>`;
  return `<button class="skill-row ${published ? "" : "is-locked"}" data-skill="${skill.id}" ${published ? "" : "disabled aria-disabled=\"true\""}>${content}</button>`;
}

function renderDiagnostic() {
  const data = studentData(), diagnostic = data.diagnostic;
  if (activeProfile().status === "paused") return renderDashboard();
  if (diagnostic.complete) {
    const skills = progressEntries(data);
    return `<div class="page-heading"><div><span class="eyebrow">TON POINT DE DÉPART</span><h1>Ta carte de compétences</h1><p>Ce bilan est un repère pour choisir la prochaine activité, pas une note.</p></div><span class="page-icon icon-blue">◉</span></div>
      <div class="diagnostic-summary"><div class="summary-mark">✳</div><div><b>Bien joué d’avoir essayé, ${esc(activeProfile().pseudonym)}.</b><p>On sait maintenant sur quoi s’appuyer et quoi retravailler ensemble.</p></div><span class="summary-count">${masteredCount(data)} / ${SKILLS.length}<small>à l’aise pour l’instant</small></span></div>
      <div class="content-columns"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">TES COMPÉTENCES</span><h2>Une photo de maintenant</h2></div><span class="tiny-status">Mise à jour aujourd’hui</span></div><div class="skill-list skill-list-bordered">${skills.map(({skill}) => renderSkillRow(skill,data)).join("")}</div></section><aside class="panel advice-panel"><span class="advice-icon">✦</span><span class="eyebrow">PROCHAINE ÉTAPE</span><h3>${data.progress["add-unlike"]?.status === "Maîtrisé" ? "Explorer une autre compétence" : "Additionner des fractions"}</h3><p>On va chercher des parts de même taille, puis additionner les numérateurs, étape par étape.</p>${isSkillPublished("add-like")&&isSkillPublished("add-unlike")?`<button class="button button-primary button-wide" data-action="start-session">${data.course.active ? "Reprendre la séance" : "Commencer la séance"}<span>→</span></button>`:`<p class="locked-copy">La séance s’ouvrira quand l’équipe aura publié les deux leçons.</p><button class="outline-button button-wide" data-view="path">Voir le parcours <span>→</span></button>`}</aside></div>`;
  }
  if (!diagnostic.started) return `<div class="page-heading"><div><span class="eyebrow">ON COMMENCE EN DOUCEUR</span><h1>Un petit point de départ</h1><p>Quelques questions nous aideront à choisir les bonnes activités pour toi.</p></div><span class="page-icon icon-green">◉</span></div>
    <section class="diagnostic-intro"><div class="diagnostic-shapes" aria-hidden="true"><span>¼</span><span>?</span><span>⅓</span></div><div class="diagnostic-intro-copy"><span class="eyebrow">6 QUESTIONS · ENVIRON 4 MIN</span><h2>Ce n’est pas un examen.</h2><p>Essaie chaque question sans pression. Tu peux prendre ton temps. Une réponse incorrecte nous dit simplement quoi retravailler.</p><ul class="checklist"><li><span>✓</span> Aucun classement ni note finale</li><li><span>✓</span> Une carte pour tes différentes compétences</li><li><span>✓</span> Ton parcours peut changer avec toi</li></ul><button class="button button-primary" data-action="start-diagnostic">Commencer <span>→</span></button></div></section>`;
  const index = diagnostic.step, item = DIAGNOSTIC[index];
  if (!item) return `<div class="diagnostic-intro"><h2>Diagnostic terminé</h2><button class="button button-primary" data-action="complete-diagnostic">Voir ma carte →</button></div>`;
  const chosen = diagnostic.answers[index]?.answer;
  const checked = diagnostic.checked;
  const isCorrect = diagnostic.answers[index]?.correct;
  return `<div class="page-heading compact-heading"><div><span class="eyebrow">DIAGNOSTIC · QUESTION ${index+1} SUR ${DIAGNOSTIC.length}</span><h1>Essaie, à ton rythme</h1><p>Choisis la réponse qui te semble juste. Tu peux changer d’avis.</p></div><span class="page-icon icon-green">${index+1}</span></div>
    <section class="question-panel"><div class="question-progress"><div class="question-track"><span style="width:${((index+1)/DIAGNOSTIC.length)*100}%"></span></div><span>${index+1} / ${DIAGNOSTIC.length}</span></div><span class="eyebrow">${esc(SKILL_BY_ID[item.skillId].title.toUpperCase())}</span><h2>${esc(item.question)}</h2>
      <form id="diagnostic-answer-form"><fieldset class="choice-list" ${checked ? "disabled" : ""}><legend class="sr-only">Choisis une réponse</legend>${item.choices.map((choice,i)=>`<label class="choice-option ${chosen===choice?"selected":""} ${checked&&choice===item.answer?"is-answer":""}"><input type="radio" name="choice" value="${esc(choice)}" ${chosen===choice?"checked":""} /><span class="choice-letter">${String.fromCharCode(65+i)}</span><span>${esc(choice)}</span>${checked&&choice===item.answer?'<span class="choice-check">✓</span>':""}</label>`).join("")}</fieldset></form>
      ${checked?`<div class="answer-feedback ${isCorrect?"feedback-good":"feedback-kind"}" role="status"><span>${isCorrect?"✓":"↗"}</span><div><b>${isCorrect?"C’est ça !":"Merci d’avoir essayé."}</b><p>${isCorrect?"On passe à la suite.":`La réponse attendue est ${esc(item.answer)}. On reprendra cette idée ensemble.`}</p></div></div>`:""}
      <div class="question-actions">${!checked?'<button class="button button-primary" data-action="check-diagnostic">Vérifier ma réponse <span>→</span></button>':`<button class="button button-primary" data-action="next-diagnostic">${index === DIAGNOSTIC.length-1 ? "Voir ma carte" : "Question suivante"}<span>→</span></button>`}<button class="text-button" data-action="show-report">Signaler un problème</button></div>
    </section>`;
}

function renderPath() {
  const data = studentData();
  return `<div class="page-heading"><div><span class="eyebrow">MATHÉMATIQUES · PARCOURS FRACTIONS</span><h1>Les fractions, pas à pas</h1><p>Six compétences pour lire, transformer et additionner des fractions.</p></div><div class="path-progress-badge">${masteredCount(data)} <small>sur ${SKILLS.length} compétences maîtrisées</small></div></div>
    ${!data.diagnostic.complete?`<div class="inline-callout"><span class="callout-icon">◉</span><div><b>Commence par ton petit bilan</b><p>Il nous aidera à te proposer le bon point de départ.</p></div><button class="text-button" data-action="start-diagnostic">Faire le diagnostic →</button></div>`:""}
    <div class="path-intro"><div class="path-intro-text"><span class="eyebrow">PARCOURS 01 · 6 COMPÉTENCES</span><h2>Des parts aux opérations</h2><p>Chaque étape s’appuie sur ce que tu sais déjà. Tu peux revoir les leçons quand tu veux.</p></div><div class="path-dots" aria-hidden="true"><span>½</span><i></i><span>+</span><i></i><span>=</span></div></div>
    <section class="module-list"><div class="module-list-heading"><span>LE PARCOURS</span><span>6 ÉTAPES</span></div>${SKILLS.map((skill,index)=>{const published=isSkillPublished(skill.id), progress=data.progress[skill.id]?.status||"Non évalué", status=published?progress:contentStatus(skill.id);return `<button class="module-row ${published?"":"module-locked"}" data-skill="${skill.id}" ${published?"":"disabled aria-disabled=\"true\""}><span class="module-number ${published&&progress === "Maîtrisé"?"module-done":""}">${published&&progress === "Maîtrisé"?"✓":published?String(index+1).padStart(2,"0"):"⌑"}</span><span class="module-copy"><small>${skill.category.toUpperCase()}${published?"":" · CONTENU NON PUBLIÉ"}</small><b>${esc(skill.title)}</b><span>${esc(published?skill.short:status==="Validé"?"Prêt à publier par l’équipe pédagogique":"En préparation par l’équipe pédagogique")}</span></span><span class="status-chip ${statusClass(status)}">${esc(status)}</span><span class="row-arrow">${published?"→":"⌑"}</span></button>`;}).join("")}</section>
    <div class="content-footnote"><span>✳</span><p>Les exercices de ce parcours sont préparés et vérifiés avant d’être proposés. Le tuteur t’aide à trouver la méthode.</p></div>`;
}

function renderSkillDetail() {
  const skill = SKILL_BY_ID[state.selectedSkillId] || SKILLS[0], data = studentData(), skillStatus = data.progress[skill.id]?.status || "Non évalué";
  const bank = EXERCISES.filter((item) => item.skillId === skill.id);
  if (!isSkillPublished(skill.id)) return `<button class="back-link" data-view="path"><span>←</span> Tous les parcours</button><section class="paused-card content-locked"><div class="paused-icon">⌑</div><span class="eyebrow">CONTENU ${esc(contentStatus(skill.id).toUpperCase())}</span><h1>Cette leçon n’est pas encore disponible.</h1><p>L’équipe pédagogique doit valider et publier ce contenu avant de le proposer aux élèves.</p><button class="button button-secondary" data-view="path">Revenir au parcours <span>→</span></button></section>`;
  return `<button class="back-link" data-view="path"><span>←</span> Tous les parcours</button><div class="page-heading detail-heading"><div><span class="eyebrow">${esc(skill.category.toUpperCase())} · LEÇON</span><h1>${esc(skill.title)}</h1><p>${esc(skill.short)}</p></div><span class="page-icon icon-blue">${skill.id === "add-unlike"?"½":"✳"}</span></div>
    <div class="content-columns lesson-columns"><article class="panel lesson-panel"><span class="lesson-chip">L’IDÉE À RETENIR</span><h2>La méthode</h2><p class="lesson-lead">${esc(skill.lesson)}</p><div class="example-heading"><span class="eyebrow">3 EXEMPLES GUIDÉS</span></div><div class="example-list">${skill.examples.map((example,index)=>`<div class="example-row"><span class="example-num">0${index+1}</span><p>${esc(example)}</p></div>`).join("")}</div><div class="errors-box"><span class="eyebrow">À SURVEILLER</span><ul>${skill.errors.map((error)=>`<li>${esc(error)}</li>`).join("")}</ul></div></article>
    <aside class="panel lesson-aside"><span class="status-chip ${statusClass(skillStatus)}">${esc(skillStatus)}</span><div class="aside-stat"><b>${bank.length}</b><span>exercices validés<br>à difficulté graduée</span></div><div class="level-key"><span><i class="legend-blue"></i> Départ <b>01–05</b></span><span><i class="legend-green"></i> En progrès <b>06–10</b></span><span><i class="legend-blue"></i> Défi <b>11–15</b></span></div><p>Tu peux utiliser autant d’indices que tu veux. Ils t’aident à comprendre, ils ne retirent aucun point.</p><button class="button button-primary button-wide" data-action="start-practice" data-id="${skill.id}">S’entraîner sur cette compétence <span>→</span></button>${skill.id === "add-unlike"?`<button class="outline-button button-wide" data-action="start-session">${data.course.active?"Reprendre":"Faire la séance guidée"}<span>→</span></button>`:""}</aside></div>`;
}

function currentExercise(skillId) {
  const data = studentData();
  return EXERCISES.find((item) => item.skillId === skillId && !data.completedExerciseIds.includes(item.id)) || EXERCISES.find((item) => item.skillId === skillId);
}

function renderBankExercise() {
  const data = studentData(), practice = data.practice, skill = SKILL_BY_ID[practice.skillId] || SKILLS[0];
  if (!isSkillPublished(skill.id)) return renderSkillDetail();
  const bank = EXERCISES.filter((item) => item.skillId === skill.id);
  const completed = data.completedExerciseIds.filter((id) => id.startsWith(`${skill.id}-`)).length;
  const exercise = bank.find((item) => !data.completedExerciseIds.includes(item.id));
  if (!exercise) return `<button class="back-link" data-view="path-detail"><span>←</span> Revenir à la leçon</button><section class="session-finish practice-finish"><span class="finish-spark">✳</span><span class="eyebrow">COMPÉTENCE TERMINÉE</span><h2>Tu as terminé les 15 exercices.</h2><p>Tu as pratiqué ${esc(skill.title.toLowerCase())}. Tu peux revoir la leçon ou explorer une autre compétence.</p><button class="button button-primary" data-view="path">Choisir une autre compétence <span>→</span></button></section>`;
  const hint = practice.hintLevel ? `<div class="hint-card"><span>INDICE ${practice.hintLevel}</span><p>${esc(exercise.solution[Math.min(practice.hintLevel-1,exercise.solution.length-1)])}</p></div>` : "";
  const feedback = practice.feedback ? `<div class="answer-feedback ${practice.feedback.correct?"feedback-good":"feedback-kind"}" role="status"><span>${practice.feedback.correct?"✓":"↗"}</span><div><b>${practice.feedback.correct?"Réponse correcte.":"Pas encore."}</b><p>${esc(practice.feedback.message)}</p>${practice.feedback.correct?`<ol class="solution-steps">${exercise.solution.map((line)=>`<li>${esc(line)}</li>`).join("")}</ol>`:""}</div></div>` : "";
  return `<button class="back-link" data-view="path-detail"><span>←</span> Revenir à la leçon</button><div class="page-heading detail-heading"><div><span class="eyebrow">ENTRAÎNEMENT · ${esc(skill.title.toUpperCase())}</span><h1>À toi d’essayer</h1><p>Une question à la fois. Les fractions équivalentes sont acceptées.</p></div><span class="page-icon icon-green">${completed+1}<small class="fraction-count">/${bank.length}</small></span></div><div class="question-progress bank-progress"><div class="question-track"><span style="width:${(completed/bank.length)*100}%"></span></div><span>${completed} / ${bank.length} réussis</span></div><section class="exercise-card bank-exercise"><div class="exercise-card-top"><span class="exercise-type"><i></i> EXERCICE · ${esc(exercise.level.toUpperCase())}</span><span class="difficulty-tag">${String(exercise.index).padStart(2,"0")} / 15</span></div><p class="exercise-question">${esc(exercise.prompt)}</p><label class="answer-label" for="bank-answer">Ta réponse <span>Ex. 3/4</span></label><div class="answer-entry"><input id="bank-answer" inputmode="decimal" autocomplete="off" placeholder="Écris ta réponse" value="${esc(practice.answer||"")}" ${practice.feedback?.correct?"disabled":""} /><span class="answer-prefix">=</span>${practice.feedback?.correct?'<button class="button button-primary" data-action="next-bank-exercise">Exercice suivant <span>→</span></button>':'<button class="button button-primary" data-action="check-bank-answer">Vérifier <span>→</span></button>'}</div><small class="answer-help">La réponse est vérifiée par le moteur de calcul. Tu peux demander un indice.</small>${feedback}${hint}<div class="help-tools"><span class="help-tools-label">BESOIN D’UN COUP DE POUCE ?</span><div class="help-tool-row"><button data-action="bank-hint" ${practice.feedback?.correct||practice.hintLevel>=3?"disabled":""}>＋ Donne-moi un indice</button><button data-action="show-report">Signaler un problème</button></div></div></section>`;
}

function tutorBubble(content, label = "TON TUTEUR") {
  return `<div class="tutor-bubble"><span class="tutor-avatar" aria-hidden="true">m</span><div><small>${label} · MODE DÉMO</small><p>${content}</p></div></div>`;
}

function renderSessionQuestion(question, choices = null) {
  const course = studentData().course;
  if (choices) {
    return `<fieldset class="session-choice-list" ${course.feedback ? "disabled" : ""}><legend class="sr-only">Choisis une réponse</legend>${choices.map((choice,index)=>`<label class="choice-option ${course.selected===choice.value?"selected":""} ${course.feedback&&choice.correct?"is-answer":""}"><input type="radio" name="session-choice" value="${esc(choice.value)}" ${course.selected===choice.value?"checked":""} /><span class="choice-letter">${String.fromCharCode(65+index)}</span><span>${esc(choice.label)}</span></label>`).join("")}</fieldset><button class="button button-primary" data-action="check-session" ${course.feedback?"hidden":""}>Vérifier <span>→</span></button>`;
  }
  return `<p class="exercise-question">${esc(question)}</p><label class="answer-label" for="session-answer">Ta réponse <span>Ex. 3/4</span></label><div class="answer-entry"><input id="session-answer" inputmode="decimal" autocomplete="off" placeholder="Écris une fraction" value="${esc(course.answer || "")}" ${course.feedback?"disabled":""} /><span class="answer-prefix">=</span><button class="button button-primary" data-action="check-session" ${course.feedback?"hidden":""}>Vérifier <span>→</span></button></div><small class="answer-help">Tu peux écrire 3/4, 6/8 ou 0,75 : les fractions équivalentes sont reconnues.</small>`;
}

function feedbackBlock(course) {
  if (!course.feedback) return "";
  return `<div class="answer-feedback ${course.feedback.correct?"feedback-good":"feedback-kind"}" role="status"><span>${course.feedback.correct?"✓":"↗"}</span><div><b>${course.feedback.correct?"Réponse correcte.":"Pas encore, et c’est normal."}</b><p>${esc(course.feedback.message)}</p>${course.feedback.correct?`<button class="text-button" data-action="show-solution">Voir les étapes de la méthode <span>↓</span></button>`:""}</div></div>${course.showSolution?`<ol class="solution-steps">${course.feedback.solution.map((line)=>`<li>${esc(line)}</li>`).join("")}</ol>`:""}`;
}

function renderPractice(skillId, stageTitle) {
  const data = studentData(), course = data.course, exercise = currentExercise(skillId), skill = SKILL_BY_ID[skillId];
  const hints = Array.from({ length: course.hintLevel }, (_, index) => `<div class="hint-card"><span>INDICE ${index+1}</span><p>${esc(demoTeacher.hint(index+1))}</p></div>`).join("");
  const alternate = course.alternative ? `<div class="hint-card alternative-card"><span>UNE AUTRE FAÇON DE VOIR</span><p>${esc(demoTeacher.alternate())}</p></div>` : "";
  const reasoning = course.reasoningPrompt ? `<div class="hint-card"><span>VÉRIFIER SON RAISONNEMENT</span><p>${esc(demoTeacher.invite("reasoning"))}</p></div>` : "";
  const confused = course.helpNotice ? `<div class="hint-card alternative-card"><span>ON REPREND ENSEMBLE</span><p>${esc(course.helpNotice)}</p></div>` : "";
  return `<div class="session-copy"><span class="eyebrow">${esc(stageTitle.toUpperCase())} · ${esc(skill.title.toUpperCase())}</span><h2>${skillId === "add-like" ? "On fait la première ensemble." : "Maintenant, essaie seul·e."}</h2>${tutorBubble(skillId === "add-like" ? "Lis les fractions. Qu’est-ce qui te semble important avant de commencer ?" : "Prends ton temps. Écris le résultat sous forme de fraction simplifiée.")}</div>
    <section class="exercise-card"><div class="exercise-card-top"><span class="exercise-type"><i></i> EXERCICE ${skillId === "add-like"?"GUIDÉ":"AUTONOME"}</span><span class="difficulty-tag">${esc(exercise.level)}</span></div><p class="exercise-question">${esc(exercise.prompt)}</p><label class="answer-label" for="session-answer">Ta réponse <span>Ex. 3/4</span></label><div class="answer-entry"><input id="session-answer" inputmode="decimal" autocomplete="off" placeholder="Écris une fraction" value="${esc(course.answer || "")}" ${course.feedback?"disabled":""} /><span class="answer-prefix">=</span><button class="button button-primary" data-action="check-session" ${course.feedback?"hidden":""}>Vérifier <span>→</span></button></div><small class="answer-help">Les fractions équivalentes sont reconnues. Aucune note n’est attribuée.</small>
      ${feedbackBlock(course)}${hints}${alternate}${reasoning}${confused}
      <div class="help-tools"><span class="help-tools-label">BESOIN D’UN COUP DE POUCE ?</span><div class="help-tool-row"><button data-action="tutor-help" data-kind="hint" ${course.feedback?.correct||course.hintLevel>=4?"disabled":""}>＋ Donne-moi un indice</button><button data-action="tutor-help" data-kind="confused">Je n’ai pas compris</button><button data-action="tutor-help" data-kind="alternate">Explique autrement</button><button data-action="tutor-help" data-kind="reasoning">Vérifie mon raisonnement</button></div></div>
    </section>`;
}

function renderSession() {
  const data = studentData(), course = data.course, step = Math.max(0, Math.min(course.step || 0, SESSION_STAGES.length - 1));
  if (activeProfile().status === "paused") return renderDashboard();
  if (!data.diagnostic.complete) return `<div class="page-heading"><div><span class="eyebrow">AVANT LA SÉANCE</span><h1>On choisit le bon point de départ</h1><p>Fais ton petit bilan pour que ton tuteur adapte les exercices.</p></div></div><button class="button button-primary" data-action="start-diagnostic">Commencer le diagnostic <span>→</span></button>`;
  if (!isSkillPublished("add-like") || !isSkillPublished("add-unlike")) return `<div class="page-heading"><div><span class="eyebrow">PARCOURS EN PRÉPARATION</span><h1>La séance arrive bientôt.</h1><p>L’équipe pédagogique publie les leçons nécessaires avant de te proposer cette séance.</p></div><span class="page-icon icon-blue">⌑</span></div><button class="outline-button" data-view="path">Voir les leçons disponibles <span>→</span></button>`;
  const stage = SESSION_STAGES[step], stageContent = (() => {
    if (step === 0) return `<div class="session-welcome"><div class="welcome-visual" aria-hidden="true"><span>½</span><b>+</b><span>¼</span></div><span class="eyebrow">SÉANCE GUIDÉE · ENVIRON 12 MIN</span><h2>Aujourd’hui, on additionne des fractions.</h2><p>On va d’abord se rappeler une idée, regarder un exemple, puis tu essaieras à ton tour. Ton tuteur ne donnera pas la réponse directement.</p>${tutorBubble(`Salut ${esc(activeProfile().pseudonym)} ! Avant de commencer, rappelle-toi : tu peux demander un indice à tout moment.`)}<button class="button button-primary" data-action="next-stage">Commencer <span>→</span></button></div>`;
    if (step === 1) return `<div class="session-copy"><span class="eyebrow">RÉACTIVATION · UNE QUESTION RAPIDE</span><h2>On réveille une idée que tu connais déjà.</h2>${tutorBubble("Si une tablette a 6 carrés et que 2 sont coloriés, quelle fraction est coloriée ?")}</div><section class="exercise-card"><p class="exercise-question">Quelle fraction représente 2 carrés coloriés sur 6 ?</p>${renderSessionQuestion("", [{value:"2/6",label:"2/6",correct:true},{value:"6/2",label:"6/2",correct:false},{value:"2/4",label:"2/4",correct:false}])}${feedbackBlock(course)}</section>`;
    if (step === 2) return `<div class="session-copy"><span class="eyebrow">MINI-LEÇON · PARTS DE MÊME TAILLE</span><h2>Avant d’additionner, on rend les parts pareilles.</h2>${tutorBubble("Un demi et un quart n’ont pas la même taille. On transforme le demi en deux quarts, puis on peut compter ensemble.")}</div><section class="lesson-live-card"><div class="fraction-equation"><span>1/2</span><b>=</b><span class="fraction-highlight">2/4</span><b>+</b><span>1/4</span><b>=</b><strong>3/4</strong></div><div class="fraction-bars"><div class="fraction-bar"><span class="filled" style="width:50%"></span><i></i><i></i><i></i><i></i></div><span>un demi</span><div class="fraction-bar quarter-bar"><span class="filled" style="width:75%"></span><i></i><i></i><i></i></div><span>trois quarts</span></div><div class="method-steps"><span><b>1</b> Je trouve des parts de même taille.</span><span><b>2</b> J’additionne les numérateurs.</span><span><b>3</b> Je garde le dénominateur et je simplifie.</span></div><p class="quiet-note">La méthode est affichée, mais on va la pratiquer ensemble juste après.</p><button class="button button-primary" data-action="next-stage">J’ai compris, je continue <span>→</span></button></section>`;
    if (step === 3) return renderPractice("add-like", stage.title);
    if (step === 4) return renderPractice("add-unlike", stage.title);
    if (step === 5) return `<div class="session-copy"><span class="eyebrow">APPLICATION · À TOI DE CHOISIR LA MÉTHODE</span><h2>Et dans une vraie situation ?</h2>${tutorBubble("Noa mange 1/2 d’une galette au goûter, puis 1/4 le soir. Quelle part de la galette a été mangée en tout ?")}</div><section class="exercise-card"><div class="story-problem"><span class="story-icon">◒</span><p>Une galette est entière. Noa mange <b>1/2</b> puis <b>1/4</b>. Quelle fraction de la galette a été mangée ?</p></div>${renderSessionQuestion("")}${feedbackBlock(course)}</section>`;
    if (step === 6) return `<div class="session-copy"><span class="eyebrow">SYNTHÈSE · TU DEVIENS L’EXPERT·E</span><h2>Explique ta méthode avec tes mots.</h2>${tutorBubble("Quand les dénominateurs sont différents, que fais-tu en premier pour pouvoir additionner ?")}</div><section class="reflection-card"><label for="reflection">Ta synthèse <span>(au moins quelques mots)</span></label><textarea id="reflection" rows="4" maxlength="360" placeholder="Quand les dénominateurs sont différents, je…"></textarea><small>Ta réponse reste dans cette session locale et n’est pas conservée dans le cahier.</small><button class="button button-primary" data-action="submit-reflection">Enregistrer ma synthèse <span>→</span></button></section>`;
    return `<section class="session-finish"><span class="finish-spark">✳</span><span class="eyebrow">SÉANCE TERMINÉE</span><h2>Tu as avancé, une étape à la fois.</h2><p>${course.helpUsed ? `Tu as utilisé ${course.helpUsed} indice${course.helpUsed>1?"s":""} pour trouver ta méthode. Demander un coup de pouce fait partie de l’apprentissage.` : "Tu as suivi la méthode jusqu’au bout et expliqué ton raisonnement."}</p><div class="finish-summary"><span><b>01</b> Compétence travaillée<small>Additionner des fractions</small></span><span><b>${course.rightAnswers || 0}</b> Réponses correctes<small>Vérifiées par le moteur de calcul</small></span><span><b>+</b> Prochaine étape<small>Réviser ou choisir un défi</small></span></div><button class="button button-primary" data-action="finish-session">Enregistrer et terminer <span>→</span></button></section>`;
  })();
  return `<div class="session-header"><button class="back-link" data-view="path"><span>←</span> Quitter la séance</button><button class="report-button" data-action="show-report"><span aria-hidden="true">⚑</span> Signaler un problème</button></div>
    <div class="session-title-row"><div><span class="eyebrow">MA SÉANCE · FRACTIONS</span><h1>Comprendre avant de calculer</h1></div><span class="session-time">◷ Environ 12 min</span></div>
    <div class="session-stepper" aria-label="Étape ${step+1} sur ${SESSION_STAGES.length}">${SESSION_STAGES.map((item,index)=>`<div class="session-step ${index===step?"active":index<step?"done":""}" ${index===step?'aria-current="step"':""}><span>${index<step?"✓":index+1}</span><small>${item.title}</small></div>`).join("")}</div><div class="step-progress"><span style="width:${((step+1)/SESSION_STAGES.length)*100}%"></span></div>
    <section class="session-stage"><div class="stage-intro"><span class="eyebrow">ÉTAPE ${String(step+1).padStart(2,"0")} · ${esc(stage.hint.toUpperCase())}</span><span class="stage-dots" aria-hidden="true">${SESSION_STAGES.map((_,i)=>`<i class="${i<=step?"active":""}"></i>`).join("")}</span></div>${stageContent}${step>0&&step<7&&studentData().course.feedback?.correct?'<div class="continue-row"><button class="button button-primary" data-action="next-stage">Continuer <span>→</span></button></div>':""}</section>`;
}

function renderNotebook() {
  const data = studentData();
  const history = data.attemptLog.slice(-6).reverse();
  return `<div class="page-heading"><div><span class="eyebrow">TON ESPACE PERSONNEL</span><h1>Mon cahier numérique</h1><p>Leçons, méthodes et exercices que tu as travaillés.</p></div><span class="page-icon icon-green">▤</span></div><div class="notebook-summary"><div class="notebook-stat"><span class="mini-icon icon-blue">▤</span><b>${data.stats.sessions}</b><small>séance${data.stats.sessions===1?"":"s"} terminée${data.stats.sessions===1?"":"s"}</small></div><div class="notebook-stat"><span class="mini-icon icon-green">✓</span><b>${data.completedExerciseIds.length}</b><small>exercice${data.completedExerciseIds.length===1?"":"s"} réussi${data.completedExerciseIds.length===1?"":"s"}</small></div><div class="notebook-stat"><span class="mini-icon icon-blue">◷</span><b>${data.stats.minutes}</b><small>minute${data.stats.minutes===1?"":"s"} de pratique</small></div></div>
    <div class="content-columns notebook-columns"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">MON HISTORIQUE</span><h2>Mes dernières réponses</h2></div></div>${history.length?`<div class="attempt-list">${history.map((attempt)=>`<div class="attempt-row"><span class="attempt-check ${attempt.correct?"":"attempt-review"}">${attempt.correct?"✓":"↗"}</span><div><b>${esc(SKILL_BY_ID[attempt.skillId]?.title || "Exercice")}</b><small>${esc(attempt.exerciseId.replace(/^[^-]+-/,"Exercice "))} · ${attempt.correct?"Réussi":"À revoir"}</small></div><span class="attempt-date">${dateLabel(attempt.at)}</span></div>`).join("")}</div>`:`<div class="empty-state"><span>▤</span><b>Ton cahier se remplit au fil des séances</b><p>Les erreurs et les méthodes seront enregistrées pour t’aider à progresser.</p><button class="text-button" data-action="start-diagnostic">Commencer par le diagnostic <span>→</span></button></div>`}</section><aside class="panel notebook-methods"><span class="eyebrow">MES LEÇONS</span><h2>Mes méthodes à retenir</h2><div class="method-note"><span>½</span><div><b>Addition de fractions</b><small>${data.course.complete?"Séance terminée":"À découvrir avec ton tuteur"}</small></div></div><div class="method-note"><span>↗</span><div><b>Mes erreurs expliquées</b><small>${history.filter((item)=>!item.correct).length} point${history.filter((item)=>!item.correct).length===1?"":"s"} à retravailler</small></div></div><button class="outline-button button-wide" data-view="path">Parcourir les leçons <span>→</span></button></aside></div>`;
}

function renderParent() {
  const profile = activeProfile(), data = studentData();
  const alerts = data.alerts.filter((alert) => alert.status !== "Résolu");
  const profilesOptions = state.profiles.map((item)=>`<option value="${item.id}" ${item.id===profile.id?"selected":""}>${esc(item.pseudonym)} · ${esc(item.schoolLevel)}</option>`).join("");
  return `<div class="page-heading"><div><span class="eyebrow">SUIVI FAMILLE · DONNÉES LOCALES DE DÉMO</span><h1>Espace parent</h1><p>Un aperçu clair des progrès et des paramètres du profil.</p></div><button class="button button-secondary" data-action="show-add-profile"><span>＋</span> Ajouter un profil</button></div>
    <div class="parent-profile-bar"><div class="parent-profile-avatar">${esc(profile.pseudonym.slice(0,1).toUpperCase())}</div><div><label for="profile-select" class="eyebrow">PROFIL SUIVI</label><select id="profile-select">${profilesOptions}</select></div><span class="consent-record"><i></i> Accord enregistré · ${dateLabel(profile.consentAt)}</span><span class="profile-state ${profile.status==="active"?"":"state-paused"}">${profile.status === "active" ? "Actif" : "En pause"}</span></div>
    <div class="parent-kpis"><article><span class="kpi-icon icon-blue">◷</span><div><b>${data.stats.minutes} <small>min</small></b><span>Temps de séance cumulé</span></div></article><article><span class="kpi-icon icon-green">✳</span><div><b>${data.stats.sessions}</b><span>Séances terminées</span></div></article><article><span class="kpi-icon icon-blue">↗</span><div><b>${masteredCount(data)} <small>/ ${SKILLS.length}</small></b><span>Compétences maîtrisées</span></div></article><article><span class="kpi-icon icon-green">⚑</span><div><b>${alerts.length}</b><span>Alertes à consulter</span></div></article></div>
      <div class="content-columns parent-columns"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">PROGRESSION EN MATHÉMATIQUES</span><h2>Carte de compétences</h2></div><span class="tiny-status">${data.diagnostic.complete?"Actualisée après le diagnostic":"Diagnostic à commencer"}</span></div>${data.diagnostic.complete?`<div class="skill-list skill-list-bordered">${SKILLS.map((skill)=>renderSkillRow(skill,data,false)).join("")}</div>`:`<div class="empty-inline"><span>◉</span><div><b>Le diagnostic n’a pas encore été fait</b><p>Les compétences apparaîtront dès la première séance de repérage.</p><button class="text-button" data-action="start-diagnostic">Ouvrir le diagnostic de démo <span>→</span></button></div></div>`}<div class="parent-note"><span>ⓘ</span><p>Le niveau évolue avec la pratique. Une erreur signale simplement une notion à retravailler.</p></div></section>
      <aside class="panel settings-panel"><span class="eyebrow">PARAMÈTRES FAMILLE</span><h2>Garder le contrôle</h2><label for="daily-limit">Temps quotidien souhaité</label><select id="daily-limit"><option value="20" ${profile.dailyLimit===20?"selected":""}>20 minutes</option><option value="30" ${profile.dailyLimit===30?"selected":""}>30 minutes</option><option value="45" ${profile.dailyLimit===45?"selected":""}>45 minutes</option><option value="0" ${profile.dailyLimit===0?"selected":""}>Sans limite</option></select><p class="setting-help">Un rappel s’affichera à l’élève dans cette démo. Le contrôle en temps réel sera géré par le service sécurisé.</p><div class="settings-divider"></div><button class="setting-action" data-action="export-data"><span class="setting-action-icon">↓</span><span><b>Exporter les données</b><small>Télécharger une copie JSON</small></span><span class="row-arrow">→</span></button><button class="setting-action" data-action="toggle-pause"><span class="setting-action-icon">Ⅱ</span><span><b>${profile.status === "active" ? "Mettre le profil en pause" : "Réactiver le profil"}</b><small>Le profil peut être repris plus tard</small></span><span class="row-arrow">→</span></button><button class="setting-action delete-action" data-action="confirm-delete"><span class="setting-action-icon">×</span><span><b>Supprimer les données locales</b><small>Effacer tous les profils de cette démo</small></span><span class="row-arrow">→</span></button></aside></div>
    <section class="panel parent-activity"><div class="panel-heading"><div><span class="eyebrow">ACTIVITÉ RÉCENTE</span><h2>Un suivi sans classement</h2></div><button class="text-button" data-view="notebook">Voir le cahier élève <span>→</span></button></div><div class="activity-line"><span class="activity-indicator ${data.course.complete?"activity-done":""}"></span><div><b>${data.course.complete?"Séance sur les fractions terminée":"Parcours de fractions"}</b><small>${data.course.complete?"Une séance enregistrée · "+dateLabel(data.stats.lastSessionAt):"Prochaine activité : additionner des fractions"}</small></div><span class="activity-status">${data.course.complete?"Terminé":"À venir"}</span></div><div class="activity-line"><span class="activity-indicator ${data.diagnostic.complete?"activity-done":""}"></span><div><b>Diagnostic initial</b><small>${data.diagnostic.complete?"6 compétences repérées":"À démarrer · 6 questions"}</small></div><span class="activity-status">${data.diagnostic.complete?"Terminé":"À venir"}</span></div></section>
    <section class="panel parent-alerts"><div class="panel-heading"><div><span class="eyebrow">SÉCURITÉ & BIEN-ÊTRE</span><h2>Alertes du profil</h2></div><span class="alert-count">${data.alerts.filter((alert)=>alert.status!=="Résolu").length}</span></div>${data.alerts.length?`<div class="alert-list">${data.alerts.slice(0,5).map((alert)=>`<article class="alert-row"><span class="alert-severity ${alert.severity==="Élevée"?"severity-high":""}">!</span><div><b>${esc(alert.category)}</b><small>${dateLabel(alert.at)}${alert.reviewedAt?" · revue effectuée":" · en attente de revue humaine"}</small></div><span class="status-chip ${alert.status==="Résolu"?"status-green":"status-blue"}">${esc(alert.status)}</span></article>`).join("")}</div>`:`<div class="empty-inline"><span class="parent-check">✓</span><div><b>Aucune alerte pour le moment</b><p>Les demandes de soutien seront visibles ici et par l’équipe pédagogique.</p></div></div>`}</section>`;
}

function allAlerts() {
  return state.profiles.flatMap((profile) => studentData(profile).alerts.map((alert) => ({ ...alert, pseudonym: profile.pseudonym, profileId: profile.id })));
}

function renderAdmin() {
  const items = CONTENT_ITEMS.map((item)=>({ ...item, status: state.contentStatuses[item.id] || item.status }));
  const alerts = allAlerts().filter((alert)=>alert.status!=="Résolu");
  return `<div class="page-heading"><div><span class="eyebrow">ÉQUIPE PÉDAGOGIQUE · OUTILS DE DÉMO</span><h1>Contenus & supervision</h1><p>Le contenu suit un cycle de validation. Les alertes demandent une revue humaine.</p></div><span class="page-icon icon-green">▣</span></div>
    <div class="admin-kpis"><article><span class="kpi-icon icon-blue">▤</span><b>${items.reduce((sum,item)=>sum+item.exercises,0)}</b><small>exercices validés</small></article><article><span class="kpi-icon icon-green">✓</span><b>${items.filter((item)=>item.status==="Publié").length}</b><small>leçons publiées</small></article><article><span class="kpi-icon icon-blue">⚑</span><b>${alerts.length}</b><small>alertes ouvertes</small></article></div>
    <div class="content-columns admin-columns"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">BIBLIOTHÈQUE DE CONTENUS</span><h2>Parcours fractions</h2></div><span class="tiny-status">Cycle Brouillon → Validé → Publié → Archivé</span></div><div class="admin-content-list">${items.map((item)=>`<div class="admin-content-row"><div class="content-type-icon">½</div><div class="admin-content-copy"><b>${esc(item.title)}</b><small>Fractions · ${item.exercises} exercices vérifiés</small></div><span class="status-chip ${statusClass(item.status)}">${esc(item.status)}</span><button class="outline-button small-outline" data-action="advance-content" data-id="${item.id}" ${item.status==="Archivé"?"disabled":""}>${item.status==="Brouillon"?"Valider":item.status==="Validé"?"Publier":item.status==="Publié"?"Archiver":"Archivé"}</button></div>`).join("")}</div><p class="table-note">Les 90 exercices sont calculés et contrôlés dans cette démo par des règles déterministes.</p></section>
      <section class="panel alerts-panel"><div class="panel-heading"><div><span class="eyebrow">REVUE HUMAINE</span><h2>Alertes de sécurité</h2></div><span class="alert-count">${alerts.length}</span></div>${alerts.length?`<div class="alert-list">${alerts.map((alert)=>`<article class="alert-row"><span class="alert-severity ${alert.severity==="Élevée"?"severity-high":""}">!</span><div><b>${esc(alert.category)}</b><small>Profil ${esc(alert.pseudonym)} · ${dateLabel(alert.at)}</small></div><span class="status-chip status-blue">À traiter</span><button class="icon-button" data-action="resolve-alert" data-id="${alert.id}" aria-label="Marquer l’alerte comme traitée">✓</button></article>`).join("")}</div>`:`<div class="empty-state alert-empty"><span>✓</span><b>Aucune alerte à traiter</b><p>Les alertes générées par les demandes d’aide apparaîtront ici.</p></div>`}<div class="human-review-note"><span>⌑</span><p>L’enseignant IA ne clôt aucune alerte de façon autonome. Une personne de l’équipe doit la revoir.</p></div></section></div>
    <div class="privacy-callout"><span>ⓘ</span><div><b>Réponses mathématiques vérifiées séparément</b><p>Le moteur pédagogique choisit la prochaine compétence. Aucun modèle de langage n’est connecté à cette démonstration.</p></div></div>`;
}

function renderTariffs() {
  return `<div class="page-heading centered-heading"><div><span class="eyebrow">DES OFFRES SIMPLES</span><h1>Apprendre sans pression.</h1><p>Des tarifs de démonstration, prêts à être reliés à un paiement sécurisé.</p></div></div><div class="pricing-grid"><article class="pricing-card"><span class="eyebrow">POUR DÉCOUVRIR</span><h2>Découverte</h2><p>Les premiers pas avec le tuteur de maths.</p><div class="price">Gratuit</div><ul><li>✓ Profil élève</li><li>✓ Diagnostic de départ</li><li>✓ Parcours fractions</li><li>✓ Suivi parent</li></ul><button class="outline-button button-wide" data-action="activate-trial">${state.subscription==="Essai gratuit"?"Offre active":"Choisir Découverte"}<span>→</span></button></article><article class="pricing-card pricing-featured"><span class="featured-label">DÉMO</span><span class="eyebrow">POUR CONTINUER</span><h2>Progression</h2><p>Plus de séances pour pratiquer chaque semaine.</p><div class="price">2 900 <small>FCFA / mois</small></div><ul><li>✓ Tout le contenu Découverte</li><li>✓ Nouveaux parcours de maths</li><li>✓ Bilans parent détaillés</li><li>✓ Historique des séances</li></ul><button class="button button-primary button-wide" data-action="activate-trial">Simuler l’abonnement <span>→</span></button></article></div><p class="pricing-note">Le paiement n’est pas connecté. Aucun débit n’a lieu dans la démo.</p>`;
}

function renderCurrentView() {
  const views = { dashboard: renderDashboard, diagnostic: renderDiagnostic, path: renderPath, "path-detail": renderSkillDetail, practice: renderBankExercise, session: renderSession, notebook: renderNotebook, parent: renderParent, admin: renderAdmin, tariffs: renderTariffs };
  return (views[state.view] || renderDashboard)();
}

function render() {
  if (!state.profiles.length) { app.innerHTML = renderSetup(); return; }
  if (!activeProfile()) state.activeProfileId = state.profiles[0].id;
  if (["session", "diagnostic", "practice"].includes(state.view) && activeProfile().status === "paused" && state.role === "student") state.view = "dashboard";
  app.innerHTML = `<div class="app-shell">${renderSidebar()}<div class="main-shell">${renderTopbar()}<main class="page-content" id="main-content" tabindex="-1">${renderCurrentView()}</main><footer class="app-footer"><span>MathIA <i>·</i> Comprendre. Raisonner. Créer.</span><span>Démo locale <i>·</i> Données fictives</span><button data-action="show-report">Signaler un problème</button></footer></div></div>`;
}

function setCourseStage(step) {
  const course = studentData().course;
  course.step = Math.max(0, Math.min(step, SESSION_STAGES.length - 1));
  course.hintLevel = 0; course.alternative = false; course.reasoningPrompt = false;
  course.helpNotice = "";
  course.answer = ""; course.selected = ""; course.feedback = null; course.showSolution = false;
  persist(); render();
}

function startSession() {
  const data = studentData();
  if (!data.diagnostic.complete) { state.role = "student"; state.view = "diagnostic"; data.diagnostic.started = true; persist(); render(); return; }
  if (!isSkillPublished("add-like") || !isSkillPublished("add-unlike")) { state.role="student"; state.view="path"; persist(); render(); notify("L’équipe doit publier les leçons de cette séance avant de pouvoir la commencer."); return; }
  if (!data.course.active || data.course.complete) {
    data.course = { active: true, complete: false, step: 0, hintLevel: 0, wrongCount: 0, helpUsed: 0, rightAnswers: 0, startedAt: Date.now(), alerted: false };
  }
  state.role = "student"; state.view = "session"; persist(); render();
}

function recordSafetyAlert(category, severity = "Normale") {
  const data = studentData();
  data.alerts.unshift({ id: newId(), category, severity, status: "À traiter", at: new Date().toISOString() });
  persist();
}

function checkDiagnostic() {
  const item = DIAGNOSTIC[studentData().diagnostic.step];
  const choice = document.querySelector('input[name="choice"]:checked')?.value;
  if (!choice) { notify("Choisis une réponse avant de continuer."); return; }
  const correct = choice === item.answer, data = studentData(), diagnostic = data.diagnostic;
  diagnostic.answers[diagnostic.step] = { answer: choice, correct, skillId: item.skillId };
  data.progress[item.skillId] = { status: correct ? "Maîtrisé" : "À renforcer", score: correct ? 1 : 0, updatedAt: new Date().toISOString() };
  diagnostic.checked = true; persist(); render();
}

function completeDiagnostic() {
  const data = studentData(); data.diagnostic.complete = true; data.diagnostic.started = true; data.diagnostic.checked = false;
  state.view = "diagnostic"; persist(); render();
}

function checkSessionAnswer() {
  const data = studentData(), course = data.course, step = course.step;
  let exercise, answer, expected;
  if (step === 1) {
    const selected = document.querySelector('input[name="session-choice"]:checked')?.value || course.selected;
    if (!selected) { notify("Choisis une réponse avant de continuer."); return; }
    answer = selected; expected = "2/6";
  } else if (step === 3 || step === 4) {
    exercise = currentExercise(step === 3 ? "add-like" : "add-unlike");
    answer = document.querySelector("#session-answer")?.value || "";
    expected = exercise.answer;
  } else if (step === 5) {
    answer = document.querySelector("#session-answer")?.value || "";
    expected = "3/4";
  } else return;
  if (!String(answer).trim()) { notify("Écris une réponse avant de continuer."); return; }
  const correct = isEquivalent(answer, expected);
  if (step === 1) course.selected = answer;
  else course.answer = answer;
  if (step === 3 || step === 4) {
    course.currentExerciseId = exercise.id;
    data.attemptLog.push({ exerciseId: exercise.id, skillId: exercise.skillId, correct, helpLevel: course.hintLevel, at: new Date().toISOString() });
    if (correct && !data.completedExerciseIds.includes(exercise.id)) data.completedExerciseIds.push(exercise.id);
  }
  if (correct) {
    course.feedback = {
      correct: true,
      message: step === 1 ? "2 parts sur 6 donnent bien 2/6. Les parts ont la même taille." : "Ton résultat correspond à la valeur attendue. Une autre écriture équivalente est acceptée.",
      solution: exercise?.solution || ["Repère les informations importantes.", "Choisis une méthode et effectue le calcul.", `Vérifie que ta réponse correspond à ${expected}.`]
    };
    course.rightAnswers = (course.rightAnswers || 0) + 1;
    if (step === 3) data.progress["add-like"] = { status: "En cours", score: 0.5, updatedAt: new Date().toISOString() };
    if (step === 4 || step === 5) data.progress["add-unlike"] = { status: "En cours", score: 0.75, updatedAt: new Date().toISOString() };
  } else {
    course.wrongCount = (course.wrongCount || 0) + 1;
    const misstep = step === 1 ? "Compte les parts coloriées comme numérateur et garde le total comme dénominateur." : step === 5 ? "Cherche un dénominateur commun aux deux fractions avant de compter les parts." : (exercise?.frequentError || "Essaie de trouver des parts de même taille avant l’addition.");
    course.feedback = { correct: false, message: misstep, solution: [] };
    if (course.wrongCount >= 3 && !course.alerted) { course.alerted = true; recordSafetyAlert("Plusieurs essais sans réussite · revue pédagogique", "Normale"); }
  }
  persist(); render();
}

function showProfileModal() {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-profile-title"><button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button><span class="eyebrow">NOUVEAU PROFIL ÉLÈVE</span><h2 id="modal-profile-title">Ajouter un profil</h2><p>Utilise un pseudonyme et donne ton accord avant l’accès au parcours de démonstration.</p>${profileFormMarkup(true)}</section></div>`;
  modalRoot.querySelector("#pseudonym")?.focus();
}

function profileFormMarkup(inModal = false) {
  return `<form id="profile-form" class="form-stack modal-form"><label for="pseudonym">Pseudonyme de l’élève</label><input id="pseudonym" name="pseudonym" maxlength="24" placeholder="Ex. Lila ou SuperNova" autocomplete="off" required /><small>Choisis un pseudo. N’utilise pas le nom complet.</small><label for="school-level">Niveau scolaire</label><select id="school-level" name="schoolLevel" required><option value="">Choisir le niveau</option><option>5e</option><option>4e</option><option>3e</option></select><label class="consent-check"><input type="checkbox" name="consent" required /><span>Je suis parent ou responsable légal et j’autorise l’utilisation du profil dans cette démonstration.</span></label><button class="button button-primary button-wide" type="submit">${inModal?"Créer le profil":"Créer le profil"}<span>→</span></button></form>`;
}

function showDeleteModal() {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card delete-modal" role="dialog" aria-modal="true" aria-labelledby="modal-delete-title"><button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button><span class="eyebrow">ACTION PARENT</span><h2 id="modal-delete-title">Effacer les données de la démo ?</h2><p>Cette action supprime dans ce navigateur les profils, les bilans, les réponses enregistrées et les alertes de démonstration.</p><div class="modal-actions"><button class="outline-button" data-action="close-modal">Garder les données</button><button class="button button-danger" data-action="delete-data">Effacer les données</button></div></section></div>`;
  modalRoot.querySelector("[data-action='close-modal']")?.focus();
}

function showReportModal() {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-report-title"><button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button><span class="eyebrow">AIDE & SÉCURITÉ</span><h2 id="modal-report-title">Comment peut-on aider ?</h2><p>Choisis le motif qui correspond. N’ajoute pas d’informations personnelles dans cette démo.</p><form id="report-form" class="form-stack modal-form"><label for="report-category">Motif du signalement</label><select id="report-category" name="category"><option>Problème avec un exercice</option><option>Problème technique</option><option>Je souhaite parler à un adulte</option><option>Je me sens mal à l’aise</option></select><div class="privacy-note"><span class="privacy-lock">⌑</span><span>Le signalement est visible dans l’espace de l’équipe pédagogique de démonstration.</span></div><button class="button button-primary button-wide" type="submit">Envoyer le signalement <span>→</span></button></form></section></div>`;
  modalRoot.querySelector("#report-category")?.focus();
}

function exportData() {
  const clean = {
    exportedAt: new Date().toISOString(), dataType: "MathIA demo data",
    profiles: state.profiles.map((profile)=>({ pseudonym: profile.pseudonym, schoolLevel: profile.schoolLevel, consentAt: profile.consentAt, status: profile.status, dailyLimit: profile.dailyLimit })),
    learning: state.students, alerts: allAlerts(), subscription: state.subscription
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(clean,null,2)],{type:"application/json"}));
  const link = document.createElement("a"); link.href = url; link.download = "mathia-export-demo.json"; link.click(); URL.revokeObjectURL(url);
  notify("L’export JSON a été téléchargé.");
}

function progressContent(id) {
  const statuses = ["Brouillon", "Validé", "Publié", "Archivé"];
  const item = CONTENT_ITEMS.find((content)=>content.id===id); if (!item) return;
  const current = state.contentStatuses[id] || item.status, index = statuses.indexOf(current);
  if (index >= 0 && index < statuses.length - 1) {
    state.contentStatuses[id] = statuses[index + 1]; persist(); render();
    notify(`Contenu passé au statut « ${statuses[index+1]} ».`);
  }
}

function handleClick(event) {
  const button = event.target.closest("[data-action], [data-view], [data-skill]");
  if (!button) return;
  if (button.tagName === "A") event.preventDefault();
  if (button.hasAttribute("data-skill")) { state.selectedSkillId = button.dataset.skill; state.view = "path-detail"; state.role="student"; persist(); render(); return; }
  if (button.hasAttribute("data-view")) { setView(button.dataset.view); return; }
  const action = button.dataset.action;
  if (action === "close-modal") { modalRoot.innerHTML = ""; return; }
  if (action === "start-diagnostic") { const d=studentData().diagnostic; d.started=true; state.role="student"; state.view="diagnostic"; persist(); render(); return; }
  if (action === "complete-diagnostic") { completeDiagnostic(); return; }
  if (action === "check-diagnostic") { checkDiagnostic(); return; }
  if (action === "next-diagnostic") {
    const diagnostic=studentData().diagnostic;
    if (diagnostic.step < DIAGNOSTIC.length - 1) { diagnostic.step++; diagnostic.checked=false; persist(); render(); }
    else { diagnostic.complete=true; diagnostic.checked=false; state.view="diagnostic"; persist(); render(); }
    return;
  }
  if (action === "start-session") { startSession(); return; }
  if (action === "start-practice") {
    if (activeProfile().status === "paused") { notify("Demande à ton parent de réactiver le profil."); return; }
    if (!isSkillPublished(button.dataset.id)) { notify("Cette leçon sera disponible après sa publication par l’équipe pédagogique."); return; }
    if (!studentData().diagnostic.complete) { studentData().diagnostic.started=true; state.role="student"; state.view="diagnostic"; persist(); render(); notify("Fais ton petit bilan avant de commencer un exercice personnalisé."); return; }
    const data=studentData(); data.practice={skillId:button.dataset.id,feedback:null,hintLevel:0,answer:""}; state.selectedSkillId=button.dataset.id; state.view="practice"; state.role="student"; persist(); render(); return;
  }
  if (action === "check-bank-answer") {
    const data=studentData(), practice=data.practice, skill=SKILL_BY_ID[practice.skillId]||SKILLS[0];
    const exercise=EXERCISES.find((item)=>item.skillId===skill.id&&!data.completedExerciseIds.includes(item.id));
    const answer=document.querySelector("#bank-answer")?.value||practice.answer||"";
    if (!exercise) { state.view="path-detail"; render(); return; }
    if (!answer.trim()) { notify("Écris une réponse avant de continuer."); return; }
    practice.answer=answer; const correct=isEquivalent(answer,exercise.answer);
    data.attemptLog.push({exerciseId:exercise.id,skillId:exercise.skillId,correct,helpLevel:practice.hintLevel,at:new Date().toISOString()});
    if (correct) {
      data.completedExerciseIds.push(exercise.id);
      const completed=data.completedExerciseIds.filter((id)=>id.startsWith(`${skill.id}-`)).length;
      data.progress[skill.id]={status:completed>=15?"Maîtrisé":"En cours",score:completed/15,updatedAt:new Date().toISOString()};
      practice.feedback={correct:true,message:"Ta réponse est équivalente à la réponse attendue. Voici les étapes qui permettent de la vérifier."};
    } else practice.feedback={correct:false,message:exercise.frequentError};
    persist(); render(); return;
  }
  if (action === "bank-hint") {
    const practice=studentData().practice; practice.hintLevel=Math.min(3,(practice.hintLevel||0)+1); persist(); render(); return;
  }
  if (action === "next-bank-exercise") {
    const practice=studentData().practice; practice.feedback=null; practice.hintLevel=0; practice.answer=""; persist(); render(); return;
  }
  if (action === "next-stage") { const step=studentData().course.step; setCourseStage(step+1); return; }
  if (action === "check-session") { checkSessionAnswer(); return; }
  if (action === "tutor-help") {
    const course=studentData().course, kind=button.dataset.kind;
    if (kind === "hint") { course.hintLevel=Math.min(4,(course.hintLevel||0)+1); course.helpUsed=(course.helpUsed||0)+1; }
    if (kind === "confused") { course.hintLevel=Math.min(4,Math.max(2,course.hintLevel||0)); course.reasoningPrompt=false; course.alternative=false; course.helpUsed=(course.helpUsed||0)+1; course.helpNotice=demoTeacher.invite("confused"); }
    if (kind === "alternate") { course.alternative=true; course.reasoningPrompt=false; course.helpUsed=(course.helpUsed||0)+1; }
    if (kind === "reasoning") { course.reasoningPrompt=true; course.alternative=false; course.helpUsed=(course.helpUsed||0)+1; }
    persist(); render(); return;
  }
  if (action === "show-solution") { const course=studentData().course; course.showSolution=!course.showSolution; render(); return; }
  if (action === "submit-reflection") {
    const response=document.querySelector("#reflection")?.value.trim() || "";
    if (response.length < 8) { notify("Écris quelques mots sur ta méthode avant de continuer."); return; }
    const course=studentData().course; course.reflectionDone=true; course.step=7; persist(); render(); return;
  }
  if (action === "finish-session") {
    const data=studentData(), course=data.course;
    course.active=false; course.complete=true; course.step=7;
    data.stats.sessions+=1; data.stats.minutes+=Math.max(1,Math.round((Date.now()-(course.startedAt||Date.now()))/60000)); data.stats.lastSessionAt=new Date().toISOString();
    data.progress["add-unlike"]={status:"Maîtrisé",score:1,updatedAt:new Date().toISOString()};
    data.progress["add-like"]={status:"Maîtrisé",score:1,updatedAt:new Date().toISOString()};
    state.view="dashboard"; state.role="student"; persist(); render(); notify("Séance enregistrée dans le cahier numérique."); return;
  }
  if (action === "show-report") { showReportModal(); return; }
  if (action === "show-add-profile") { showProfileModal(); return; }
  if (action === "confirm-delete") { showDeleteModal(); return; }
  if (action === "delete-data") { localStorage.removeItem(STORAGE_KEY); state=loadState(); modalRoot.innerHTML=""; render(); notify("Les données locales de la démo ont été effacées."); return; }
  if (action === "export-data") { exportData(); return; }
  if (action === "toggle-pause") {
    const profile=activeProfile(); profile.status=profile.status === "active" ? "paused" : "active"; persist(); render(); notify(profile.status === "paused" ? "Profil mis en pause." : "Profil réactivé."); return;
  }
  if (action === "advance-content") { progressContent(button.dataset.id); return; }
  if (action === "resolve-alert") {
    for (const profile of state.profiles) { const alert=studentData(profile).alerts.find((item)=>item.id===button.dataset.id); if (alert) { alert.status="Résolu"; alert.reviewedAt=new Date().toISOString(); } }
    persist(); render(); notify("Alerte marquée comme traitée par l’équipe de démo."); return;
  }
  if (action === "activate-trial") { state.subscription="Offre de démonstration sélectionnée"; persist(); render(); notify("Choix enregistré en mode démo. Aucun paiement n’a été lancé."); return; }
}

function handleSubmit(event) {
  if (!(event.target instanceof HTMLFormElement)) return;
  if (event.target.id === "profile-form") {
    event.preventDefault();
    const form=new FormData(event.target), pseudonym=String(form.get("pseudonym")||"").trim(), schoolLevel=String(form.get("schoolLevel")||"");
    if (!form.get("consent")) { notify("L’accord d’un parent ou responsable est nécessaire."); return; }
    if (pseudonym.length < 2 || !["5e","4e","3e"].includes(schoolLevel)) { notify("Saisis un pseudonyme et un niveau scolaire."); return; }
    const isAdditional = Boolean(event.target.closest(".modal-card"));
    modalRoot.innerHTML=""; createProfile(pseudonym,schoolLevel,isAdditional); notify("Profil de démonstration créé."); return;
  }
  if (event.target.id === "report-form") {
    event.preventDefault(); const category=new FormData(event.target).get("category");
    const serious=String(category).includes("adulte")||String(category).includes("mal à l’aise");
    recordSafetyAlert(String(category),serious?"Élevée":"Normale");
    modalRoot.innerHTML=""; render(); notify(serious?"Une alerte a été créée. Parle aussi à un adulte de confiance près de toi.":"Le signalement a été transmis à l’équipe de démonstration."); return;
  }
  if (event.target.id === "diagnostic-answer-form") { event.preventDefault(); return; }
}

function handleChange(event) {
  if (event.target.id === "role-select") {
    state.role=event.target.value; state.view={student:"dashboard",parent:"parent",admin:"admin"}[state.role] || "dashboard"; persist(); render(); return;
  }
  if (event.target.id === "profile-select") {
    state.activeProfileId=event.target.value; persist(); render(); return;
  }
  if (event.target.id === "daily-limit") {
    activeProfile().dailyLimit=Number(event.target.value); persist(); notify("Paramètre enregistré dans cette démo."); return;
  }
  if (event.target.name === "session-choice") {
    studentData().course.selected=event.target.value; persist();
    event.target.closest("fieldset")?.querySelectorAll(".choice-option").forEach((label)=>label.classList.toggle("selected",label.querySelector("input")?.checked));
  }
  if (event.target.name === "choice" && event.target.form?.id === "diagnostic-answer-form") {
    event.target.closest("fieldset")?.querySelectorAll(".choice-option").forEach((label)=>label.classList.toggle("selected",label.querySelector("input")?.checked));
  }
}

function handleInput(event) {
  if (event.target.id === "session-answer") { studentData().course.answer=event.target.value; persist(); }
  if (event.target.id === "bank-answer") { studentData().practice.answer=event.target.value; persist(); }
}

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("change", handleChange);
document.addEventListener("input", handleInput);
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop")) modalRoot.innerHTML = "";
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalRoot.firstElementChild) modalRoot.innerHTML = "";
});
window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) { state=loadState(); render(); } });

render();
