export const STORAGE_KEY = "mathia-tutor-demo-v1";

export function freshState() {
  return {
    profiles: [], activeProfileId: null, role: "parent", view: "setup",
    students: {}, alerts: [], contentStatuses: {}, subscription: "Essai gratuit"
  };
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return freshState();
    const parsed = JSON.parse(stored);
    const initial = freshState();
    return { ...initial, ...parsed,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      students: parsed.students && typeof parsed.students === "object" ? parsed.students : {},
      contentStatuses: parsed.contentStatuses && typeof parsed.contentStatuses === "object" ? parsed.contentStatuses : {},
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : []
    };
  } catch {
    return freshState();
  }
}

export function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
