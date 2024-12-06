interface SiteEntry {
  siteUrl: string;
}

interface SitemapEntry {
  path: string;
}

interface IndexNowPayload {
  host: string;
  key: string;
  urlList: string[];
}

interface SubmissionResult {
  provider: string;
  status?: number;
  text?: string;
  error?: string;
}

export type { SiteEntry, SitemapEntry, IndexNowPayload, SubmissionResult };
