import { XMLParser } from "fast-xml-parser";
import { IndexNowPayload, SubmissionResult } from "./types";

export class IndexNowService {
  private readonly PROVIDERS = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
    "https://searchadvisor.naver.com/indexnow",
    "https://search.seznam.cz/indexnow",
    "https://yandex.com/indexnow",
    "https://indexnow.yep.com/indexnow",
  ];

  constructor(private readonly domain: string, private readonly key: string) {}

  async getSitemapUrls(): Promise<string[]> {
    try {
      const response = await fetch(`https://${this.domain}/sitemap.xml`);
      const data = await response.text();
      const parser = new XMLParser();
      const parsed = parser.parse(data);

      return parsed.urlset.url
        .map((entry: any) => (typeof entry === "object" ? entry.loc : entry))
        .filter((url: string) => url.includes(this.domain));
    } catch (error) {
      console.error(
        "Error fetching sitemap:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  async submitToIndexNow(urls: string[]): Promise<void> {
    try {
      const payload: IndexNowPayload = {
        host: this.domain,
        key: this.key,
        urlList: urls,
      };

      const submissions = this.PROVIDERS.map((provider) =>
        fetch(provider, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
          .then(async (response) => ({
            provider,
            status: response.status,
            text: await response.text(),
          }))
          .catch((error) => ({
            provider,
            error: error instanceof Error ? error.message : String(error),
          }))
      );

      const results: SubmissionResult[] = await Promise.all(submissions);

      results.forEach(({ provider, status, text, error }) => {
        if (error) {
          console.error(`Error submitting to ${provider}:`, error);
        } else {
          console.log(`${provider} submission response:`, status, text);
        }
      });
    } catch (error) {
      console.error(
        "Error in submitToIndexNow:",
        error instanceof Error ? error.message : error
      );
    }
  }

  async submitSitemapUrls(): Promise<void> {
    const urls = await this.getSitemapUrls();
    if (urls.length === 0) {
      console.log("No URLs found in sitemap");
      return;
    }

    console.log("Found URLs:");
    console.log(urls.join("\n"));
    console.log(`Total: ${urls.length} URLs`);

    await this.submitToIndexNow(urls);
  }
}
