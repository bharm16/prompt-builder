export interface PostHogEventRow {
  uuid: string;
  event: string;
  properties: Record<string, unknown>;
}

export interface PostHogQueryClient {
  /**
   * Fetch events to score. Per spec § 1 sampling rule:
   *   - source IN ('synthetic','dogfood') → 100%
   *   - source = 'user' → userSampleRate fraction (default 0.10 pre-launch)
   *   - source IN ('ci','dev','unknown') → excluded
   */
  fetchEventsToScore(
    eventName: string,
    hoursBack: number,
    userSampleRate: number,
  ): Promise<PostHogEventRow[]>;

  fetchAlreadyScoredIds(
    candidateIds: string[],
    rubricVersion: string,
    judgeModel: string,
  ): Promise<Set<string>>;
}

const NOOP_CLIENT: PostHogQueryClient = {
  async fetchEventsToScore(_event: string, _hours: number, _rate: number) {
    return [];
  },
  async fetchAlreadyScoredIds() {
    return new Set();
  },
};

function parseProperties(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[quality-judge] PostHog row properties JSON parse failed: ${String(err)}`,
      );
      return {};
    }
  }
  if (raw && typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return {};
}

class HttpClient implements PostHogQueryClient {
  constructor(
    private readonly host: string,
    private readonly projectId: string,
    private readonly personalApiKey: string,
  ) {}

  private async query<T>(hogql: string): Promise<T[][] | null> {
    try {
      const res = await fetch(
        `${this.host}/api/projects/${this.projectId}/query/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.personalApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: { kind: "HogQLQuery", query: hogql },
          }),
        },
      );
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(
          `[quality-judge] PostHog query failed (${res.status}): ${await res.text()}`,
        );
        return null;
      }
      const json = (await res.json()) as { results?: T[][] };
      return json.results ?? null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[quality-judge] PostHog query error: ${String(err)}`);
      return null;
    }
  }

  async fetchEventsToScore(
    eventName: string,
    hoursBack: number,
    userSampleRate: number,
  ): Promise<PostHogEventRow[]> {
    // Per-source sampling per spec § 1:
    //   synthetic + dogfood always included; user included at userSampleRate.
    const userPercent = Math.max(
      0,
      Math.min(100, Math.floor(userSampleRate * 100)),
    );
    const hogql = `
      SELECT uuid, event, properties
      FROM events
      WHERE event = '${eventName}'
        AND timestamp > now() - INTERVAL ${hoursBack} HOUR
        AND (
          properties.source IN ('synthetic', 'dogfood')
          OR (
            properties.source = 'user'
            AND cityHash64(toString(uuid)) % 100 < ${userPercent}
          )
        )
      ORDER BY timestamp DESC
      LIMIT 1000
    `;
    const rows = await this.query<unknown>(hogql);
    if (!rows) return [];
    return rows.map((r) => ({
      uuid: String(r[0]),
      event: String(r[1]),
      properties: parseProperties(r[2]),
    }));
  }

  async fetchAlreadyScoredIds(
    candidateIds: string[],
    rubricVersion: string,
    judgeModel: string,
  ): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();
    const list = candidateIds
      .map((id) => `'${id.replace(/'/g, "")}'`)
      .join(",");
    const hogql = `
      SELECT properties.scoredEventId
      FROM events
      WHERE event = 'quality.scored'
        AND properties.scoredEventId IN (${list})
        AND properties.rubricVersion = '${rubricVersion}'
        AND properties.judgeModel = '${judgeModel}'
        AND timestamp > now() - INTERVAL 7 DAY
    `;
    const rows = await this.query<unknown>(hogql);
    if (!rows) return new Set();
    return new Set(rows.map((r) => String(r[0])));
  }
}

export function createPostHogQueryClient(): PostHogQueryClient {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!personalApiKey || !projectId) {
    // Fallback for tests where these are stubbed via POSTHOG_PROJECT_API_KEY
    // (kept for test compat); production reads POSTHOG_PERSONAL_API_KEY.
    const altKey = process.env.POSTHOG_PROJECT_API_KEY;
    if (!altKey || !projectId) return NOOP_CLIENT;
    const host = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
    return new HttpClient(host, projectId, altKey);
  }
  const host = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
  return new HttpClient(host, projectId, personalApiKey);
}
