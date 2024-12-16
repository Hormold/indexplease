# 🚀 IndexPlease - Google Search Console Auto-Indexer

Automatically submit your website URLs to Google Search Console for indexing using TypeScript. No more paid SEO tools needed!

## Features

- 🔄 Automatic URL submission to Google Search Console
- 📊 Support for multiple websites
- 🗺️ Sitemap parsing
- 📑 Optional CSV input for specific URLs
- ⚡ Fast and efficient
- 🔐 Secure authentication via Google Cloud Service Account
- 🌐 IndexNow support for faster indexing

## Quick Start for Google Search Console

### 1. Clone & Install

```bash
git clone https://github.com/hormold/indexplease.git
cd indexplease
npm install
```

### 2. Set Up Google Cloud Service Account

0. Create a new project in Google Cloud Console if you don't have one already (it's free)
1. Go to [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click "+ CREATE SERVICE ACCOUNT"
3. Fill in the details and create
4. Under "Actions" → "Manage keys" → "Add key" → "Create new key"
5. Choose JSON format (it will download automatically)
6. Move the downloaded .json file to your project root
7. Rename it to `service-account.json`

### 3. Enable Google Search Console API	

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/library)
2. Search for "Google Search Console API"
3. Click "Enable"

### 4. Configure Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console)
2. Go to Settings → Users and Permissions → Add User
3. Add your service account email (looks like: `name@project-id.iam.gserviceaccount.com`)
4. Set permission level to "Owner"

### 5. Run the Tool

```bash
# Development
npm run dev
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
SERVICE_ACCOUNT_PATH=./service-account.json
USE_CSV_INPUT=false  # Set to true to use urls.csv
```

### CSV Input (Optional)

If you want to index specific URLs, create `urls.csv`:

```csv
https://example.com
https://example.com/about
https://example.com/contact
```

Then set `USE_CSV_INPUT=true` in your `.env` file.

### URL History

The tool automatically maintains an `indexed-urls.json` file that tracks all previously indexed URLs. This allows you to:
- Skip already indexed URLs
- Re-index only specific URLs
- Keep track of your indexing history

The file is created automatically on first run.

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

## IndexNow

IndexNow is a protocol that allows you to submit your website URLs to search engines for faster indexing.


## License

MIT

---
Made with ❤️ for the SEO community