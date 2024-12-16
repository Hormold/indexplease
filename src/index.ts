import { google } from "googleapis";
import { GoogleAuth, GoogleAuthOptions } from "google-auth-library";
import { parseStringPromise } from "xml2js";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as readline from "readline";
import fetch from "node-fetch";
import { config } from "dotenv";
import { IndexNowService } from "./IndexNowService";
import { SiteEntry } from "./types";

// Load env vars
config();

// Check if all env vars are set
if (!process.env.GOOGLE_KEY_FILE) {
  throw new Error("Missing required environment variables");
}

// Move flag to env
const INDEX_FROM_CSV = process.env.INDEX_FROM_CSV === "true";

class SearchConsoleService {
  private service: any;

  constructor(auth: any) {
    this.service = google.searchconsole({ version: "v1", auth });
  }

  async listSites() {
    const response = await this.service.sites.list();
    return response.data.siteEntry || [];
  }

  async listSitemaps(siteUrl: string) {
    const response = await this.service.sitemaps.list({ siteUrl });
    return response.data.sitemap || [];
  }

  async inspectUrlIndex(siteUrl: string, inspectionUrl: string) {
    const response = await this.service.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl,
        siteUrl,
      },
    });
    return response.data;
  }
}

async function getAllSiteUrls(
  service: SearchConsoleService
): Promise<string[]> {
  const sites = await service.listSites();
  return sites.map((site: SiteEntry) => site.siteUrl);
}

async function getSitemapUrl(
  service: SearchConsoleService,
  siteUrl: string
): Promise<string> {
  const sitemaps = await service.listSitemaps(siteUrl);
  return sitemaps[0].path;
}

async function getAllPagesFromSitemap(url: string): Promise<string[]> {
  const response = await fetch(url);
  const xmlData = await response.text();
  const data = await parseStringPromise(xmlData);
  return data.urlset.url.map((url: any) => url.loc[0]);
}

function getAllPagesFromCsv(path: string): string[] {
  const fileContent = fs.readFileSync(path, "utf-8");
  const records = parse(fileContent, { columns: false });
  return records[0];
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptSelect(
  message: string,
  choices: string[]
): Promise<string> {
  console.log(message);
  choices.forEach((choice, index) => {
    console.log(`${index + 1}) ${choice}`);
  });

  const answer = await prompt("Enter number: ");
  const index = parseInt(answer) - 1;
  return choices[index];
}

async function loadPreviouslyIndexedUrls(): Promise<Set<string>> {
  try {
    const data = await fs.promises.readFile("indexed-urls.json", "utf8");
    return new Set(JSON.parse(data));
  } catch {
    return new Set();
  }
}

async function saveIndexedUrls(urls: string[]): Promise<void> {
  await fs.promises.writeFile("indexed-urls.json", JSON.stringify(urls));
}

async function main() {
  // Step 1: Auth setup
  const auth = new GoogleAuth({
    keyFile: process.env.GOOGLE_KEY_FILE,
    scopes: ["https://www.googleapis.com/auth/webmasters"],
  });

  const service = new SearchConsoleService(await auth.getClient());

  // Step 2: Get all sites and let user select one
  const allSiteUrls = await getAllSiteUrls(service);
  const selectedSiteUrl = await promptSelect("Select a site:", allSiteUrls);

  if (!selectedSiteUrl) {
    console.error("No site selected");
    return;
  }

  // Extract domain for IndexNow
  // Remove sc-domain: from the domain
  console.log(`Selected site: ${selectedSiteUrl}`);
  const fullUrl = `https://${selectedSiteUrl.replace("sc-domain:", "")}`;
  const domain = new URL(fullUrl).hostname;
  console.log(`Using domain: ${domain}`);
  const indexNowService = new IndexNowService(
    domain,
    process.env.INDEXNOW_KEY!
  );

  // Step 3: Get pages to index
  let pagesToIndex: string[] = [];

  if (INDEX_FROM_CSV) {
    pagesToIndex = getAllPagesFromCsv("urls.csv");
    console.log(`Found ${pagesToIndex.length} pages in urls.csv:`);
    console.log(pagesToIndex);
  } else {
    const sitemapUrl = await getSitemapUrl(service, selectedSiteUrl);
    pagesToIndex = await getAllPagesFromSitemap(sitemapUrl);
    pagesToIndex = pagesToIndex.reverse();
    console.log(
      `Found ${pagesToIndex.length} pages in sitemap for ${selectedSiteUrl}:`
    );
    console.log(pagesToIndex);
  }

  // Step 4: Confirm and submit for indexing
  const shouldIndex =
    (
      await prompt("Should we submit all these pages for (re)indexing? (y/n): ")
    ).toLowerCase() === "y";

  if (shouldIndex) {
    const previouslyIndexed = await loadPreviouslyIndexedUrls();
    const newUrls = pagesToIndex.filter((url) => !previouslyIndexed.has(url));

    const indexChoice = await promptSelect(
      "What would you like to index? (Recommended: New URLs only, to speed up indexing)",
      ["New URLs only", "All URLs", "Previously indexed URLs only"]
    );

    let urlsToProcess: string[] = [];
    switch (indexChoice) {
      case "New URLs only":
        urlsToProcess = newUrls;
        console.log(`Found ${newUrls.length} new URLs to index`);
        break;
      case "All URLs":
        urlsToProcess = pagesToIndex;
        break;
      case "Previously indexed URLs only":
        urlsToProcess = pagesToIndex.filter((url) =>
          previouslyIndexed.has(url)
        );
        break;
    }

    if (urlsToProcess.length === 0) {
      console.log("No URLs to process");
      return;
    }

    console.log(`Processing ${urlsToProcess.length} URLs...`);

    for (const page of urlsToProcess) {
      try {
        const response = await service.inspectUrlIndex(selectedSiteUrl, page);
        const currentStatus =
          response.inspectionResult.indexStatusResult.coverageState;
        const lastCrawled =
          response.inspectionResult.indexStatusResult.lastCrawlTime;

        console.log(
          `(${page}) | Current status: ${currentStatus} | Last crawled: ${
            lastCrawled ? new Date(lastCrawled).toLocaleString() : "never"
          }`
        );
      } catch (error) {
        console.error(`Error inspecting ${page}:`, error);
      }
    }

    // Submit to IndexNow
    console.log("\nSubmitting to IndexNow providers...");
    await indexNowService.submitToIndexNow(urlsToProcess);

    // Save all processed URLs
    const allIndexed = new Set([...previouslyIndexed, ...urlsToProcess]);
    await saveIndexedUrls([...allIndexed]);

    console.log(
      `\nIndexed ${urlsToProcess.length} pages for ${selectedSiteUrl}`
    );
    console.log(`Total unique URLs indexed: ${allIndexed.size}`);
  }

  console.log("Done.");
}

main().catch(console.error);
