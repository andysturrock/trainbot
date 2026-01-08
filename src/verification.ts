/**
 * Type-safe extraction of team and enterprise IDs from various Slack payload structures.
 */
export function getSlackContext(body: unknown) {
  let teamId: string | undefined;
  let enterpriseId: string | undefined;

  const isObject = (val: unknown): val is Record<string, unknown> =>
    typeof val === 'object' && val !== null;

  if (isObject(body)) {
    // 1. Check top-level (Events API, Slash Commands)
    if (typeof body.team_id === 'string') teamId = body.team_id;
    if (typeof body.enterprise_id === 'string') enterpriseId = body.enterprise_id;

    // 2. Check nested objects (Actions, Options)
    if (!teamId && isObject(body.team) && typeof body.team.id === 'string') teamId = body.team.id;
    if (!enterpriseId && isObject(body.enterprise) && typeof body.enterprise.id === 'string') enterpriseId = body.enterprise.id;

    // 3. Fallback for Events API authorizations array
    if (!teamId && Array.isArray(body.authorizations) && body.authorizations.length > 0) {
      const auth = body.authorizations[0];
      if (isObject(auth)) {
        if (!teamId && typeof auth.team_id === 'string') teamId = auth.team_id;
        if (!enterpriseId && typeof auth.enterprise_id === 'string') enterpriseId = auth.enterprise_id;
      }
    }
  }

  return { teamId, enterpriseId };
}
