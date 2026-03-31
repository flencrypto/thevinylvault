/**
 * DiscogsService – lightweight wrapper around the Discogs database search API.
 *
 * Reads the user's personal access token from localStorage so it works in the
 * browser without any server-side infrastructure.
 */

interface DiscogsSearchResult {
  id: number;
  title: string;
  /** Lowest marketplace price (may be null if no listings exist) */
  lowestPrice: number | null;
  uri: string;
  catno: string;
}

export class DiscogsService {
  private getToken(): string | null {
    try {
      return localStorage.getItem('discogs_personal_token');
    } catch {
      return null;
    }
  }

  /**
   * Search the Discogs release database.
   * @param query - Free-text search query (artist + title + format)
   * @param options - `limit` caps the number of results (max 100)
   */
  async searchReleases(
    query: string,
    options: { limit?: number } = {},
  ): Promise<DiscogsSearchResult[]> {
    const limit = Math.min(options.limit ?? 20, 100);
    const token = this.getToken();

    const url = new URL('https://api.discogs.com/database/search');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'release');
    url.searchParams.set('per_page', String(limit));

    const headers: Record<string, string> = {
      'User-Agent': 'Vinylasis/1.0',
    };
    if (token) {
      headers['Authorization'] = `Discogs token=${token}`;
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`Discogs search failed: ${response.status}`);
    }

    const data = await response.json();
    const results: Array<Record<string, unknown>> = data.results ?? [];

    return results.map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ''),
      lowestPrice: r.lowest_price != null ? Number(r.lowest_price) : null,
      uri: String(r.uri ?? ''),
      catno: String(r.catno ?? ''),
    }));
  }
}
