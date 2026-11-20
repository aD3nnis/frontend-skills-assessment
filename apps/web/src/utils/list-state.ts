// The list's row links carry this router state, so the detail page can tell it was opened from the list
// in this session (and the list's own history entry still has its search and page). A visit with no state
// (a pasted link, a new tab) has no list to go back to.
export const LIST_LINK_STATE = { fromList: true } as const

export const cameFromList = (state: unknown): boolean =>
  typeof state === "object" && state !== null && (state as { fromList?: unknown }).fromList === true
