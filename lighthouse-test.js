const fs = require("fs");
const axios = require("axios");
const xml2js = require("xml2js");

async function initialize() {
  try {
    const chromeLauncher = await import("chrome-launcher");
    const lighthouse = await import("lighthouse");

    async function runLighthouse(url, index, total) {
      let chromeInstance = null;

      try {
        console.log(`Processing ${index + 1}/${total}: ${url}`);
        chromeInstance = await chromeLauncher.launch({
          chromeFlags: [
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-background-networking",
          ],
        });

        const options = {
          logLevel: "error",
          output: "html",
          onlyCategories: [
            "performance",
            "accessibility",
            "best-practices",
            "seo",
          ],
          port: chromeInstance.port,
          maxWaitForLoad: 30000,
        };

        const runnerResult = await lighthouse.default(url, options);
        const fileName = `./lighthouse-reports/${new Date()
          .toISOString()
          .slice(0, 10)}-${encodeURIComponent(url)}.html`;
        fs.writeFileSync(fileName, runnerResult.report);
        console.log(`✓ Report saved: ${fileName}`);
      } catch (error) {
        console.error(`✗ Error analyzing ${url}:`, error.message);
      } finally {
        if (chromeInstance) chromeInstance.kill();
      }
    }

    async function fetchSitemap(url) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        const parser = new xml2js.Parser();
        const sitemap = await parser.parseStringPromise(response.data);
        return sitemap.urlset.url.map((entry) => entry.loc[0]);
      } catch (error) {
        console.error(`Error fetching sitemap ${url}:`, error.message);
        return [];
      }
    }

    async function testWithSitemaps() {
      const sitemapUrls = [
        "https://www.rhapsodymedia.com/sitemap-0.xml",
        "https://www.rhapsodymedia.com/server-sitemap.xml",
      ];

      const allUrls = await Promise.all(sitemapUrls.map(fetchSitemap));
      const combinedUrls = [...new Set(allUrls.flat())];

      if (combinedUrls.length === 0) {
        console.log("No URLs found in the sitemaps.");
        return;
      }

      console.log(`Found ${combinedUrls.length} unique URLs to analyze`);

      for (const [index, url] of combinedUrls.entries()) {
        await runLighthouse(url, index, combinedUrls.length);
      }
    }

    fs.mkdirSync("./lighthouse-reports", { recursive: true });
    await testWithSitemaps();
  } catch (error) {
    console.error("Fatal error:", error.message);
    process.exit(1);
  }
}

initialize().catch(console.error);
