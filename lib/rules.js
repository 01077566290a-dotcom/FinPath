export const EVENT_RULES = {
  EMPLOYMENT: { planned: ['employment_timing', 'monthly_income'], yes: ['employment_timing', 'monthly_income'] },
  SALARY: { planned: ['salary_timing', 'monthly_income'], yes: ['salary_timing', 'monthly_income'] },
  INDEPENDENCE: {
    planned: ['move_timing', 'housing_type', 'savings', 'monthly_income'],
    yes: ['housing_type', 'savings', 'monthly_income'],
  },
  HOUSING: {
    planned: ['contract_timing', 'housing_type', 'deposit', 'savings'],
    yes: ['housing_type', 'deposit', 'savings'],
  },
  LOAN: { planned: ['loan_type', 'loan_amount', 'monthly_income'], yes: ['loan_type', 'loan_amount'] },
};
export const SLOT_PRIORITY = [
  'employment_timing',
  'salary_timing',
  'monthly_income',
  'move_timing',
  'housing_type',
  'savings',
  'contract_timing',
  'deposit',
  'loan_type',
  'loan_amount',
];
export function evaluateRules(state) {
  const requiredBy = {},
    pendingEvents = [],
    deferredEvents = [],
    activeEvents = [];
  for (const [type, event] of Object.entries(state.events)) {
    if (event.status === 'uncertain') {
      (state.meta.confirmedUncertain.includes(type) ? deferredEvents : pendingEvents).push(type);
      continue;
    }
    if (event.status === 'no') continue;
    activeEvents.push(type);
    for (const slot of EVENT_RULES[type]?.[event.status] || []) (requiredBy[slot] ||= []).push(type);
  }
  const requiredSlots = SLOT_PRIORITY.filter(key => requiredBy[key]);
  const missingSlots = requiredSlots.filter(key => state.slots[key] === null);
  const hasEvents = Object.keys(state.events).length > 0;
  const status = !hasEvents
    ? 'unrecognized'
    : pendingEvents.length || missingSlots.length
      ? 'collecting'
      : deferredEvents.length
        ? 'deferred'
        : activeEvents.length
          ? 'complete'
          : 'not_applicable';
  return {
    status,
    activeEvents,
    pendingEvents,
    deferredEvents,
    requiredSlots,
    missingSlots,
    requiredBy,
    events: state.events,
  };
}
