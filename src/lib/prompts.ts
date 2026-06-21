export interface Prompt {
  type: 'gratitude' | 'reframe' | 'identity'
  text: string
}

export const PROMPTS: Prompt[] = [
  { type: 'gratitude', text: "What's one thing you're grateful for today?" },
  { type: 'gratitude', text: "Name something small that went better than expected." },
  { type: 'gratitude', text: "Who's someone you're glad to have around right now?" },
  { type: 'reframe',   text: "What's one thing still in your control right now?" },
  { type: 'reframe',   text: "What would you tell a close friend facing the same day?" },
  { type: 'reframe',   text: "What's one small win from today, however small?" },
  { type: 'identity',  text: "What's one thing a growing engineer would do today?" },
  { type: 'identity',  text: "How would your future self handle today?" },
  { type: 'identity',  text: "What's one strength you used, or could use, right now?" },
]

export const PROMPT_LABEL: Record<Prompt['type'], string> = {
  gratitude: 'Gratitude',
  reframe:   'Reframe',
  identity:  'Identity',
}

export const PROMPT_ICON: Record<Prompt['type'], string> = {
  gratitude: 'gratitude',
  reframe:   'reframe',
  identity:  'identity',
}

export const PROMPT_COLOR: Record<Prompt['type'], string> = {
  gratitude: 'lavender',
  reframe:   'sky',
  identity:  'amber',
}

/** Deterministically picks a prompt by day-of-year so it's stable for the day. */
export function getPromptForDate(date: Date): Prompt {
  const start      = new Date(date.getFullYear(), 0, 0)
  const dayOfYear  = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  return PROMPTS[dayOfYear % PROMPTS.length]
}

/** Returns a color token for an energy level 1–10. */
export function energyColor(e: number): string {
  if (e <= 3) return 'var(--c-sky)'
  if (e <= 6) return 'var(--c-amber)'
  return 'var(--c-coral)'
}

export function energyLabel(e: number): string {
  if (e <= 2) return 'Very low'
  if (e <= 4) return 'Low'
  if (e <= 6) return 'Okay'
  if (e <= 8) return 'Good'
  return 'Charged'
}
