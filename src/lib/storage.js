const KEY = 'finpath-v1';
export function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!data || typeof data.plan !== 'object' || data.plan === null) return null;
    return { plan: data.plan, completed: Array.isArray(data.completed) ? data.completed.filter(x => typeof x === 'string') : [], checks: data.checks && typeof data.checks === 'object' ? data.checks : {} };
  } catch { return null; }
}
export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}
