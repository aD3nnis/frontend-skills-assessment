// Splits the API's per-field errors into those the form can attach to an input and those it cannot
// (a field the form has no input for, or a renamed key). The second group must still reach the
// user, otherwise a 400 shows nothing at all.
export const splitFieldErrors = <Name extends string>(
  fields: Record<string, string | undefined>,
  knownNames: readonly Name[],
): { known: { name: Name; message: string }[]; unknown: string[] } => {
  const known: { name: Name; message: string }[] = []
  const unknown: string[] = []
  for (const [key, message] of Object.entries(fields)) {
    if (!message) continue
    const name = knownNames.find((n) => n === key)
    if (name) known.push({ name, message })
    else unknown.push(message)
  }
  return { known, unknown }
}
