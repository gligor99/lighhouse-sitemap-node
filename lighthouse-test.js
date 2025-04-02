const fs = require("fs");
const axios = require("axios");
const xml2js = require("xml2js");

// Initialize modules and run tests
async function initialize() {
  try {
    // Import modules and store them in the scope
    const chromeLauncher = await import("chrome-launcher");
    const lighthouse = await import("lighthouse");

    // Run Lighthouse on the URL
    async function runLighthouse(url) {
      let chromeInstance = null;
      try {
        chromeInstance = await chromeLauncher.launch({
          chromeFlags: [
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
          ],
        });

        const options = {
          logLevel: "info",
          output: "html",
          onlyCategories: [
            "performance",
            "accessibility",
            "best-practices",
            "seo",
          ],
          port: chromeInstance.port,
        };

        const runnerResult = await lighthouse.default(url, options);

        const reportHtml = runnerResult.report;
        const fileName = `./lighthouse-reports/${encodeURIComponent(url)}.html`;

        fs.writeFileSync(fileName, reportHtml);
        console.log(`Lighthouse report for ${url} saved to ${fileName}`);
      } catch (error) {
        console.error(`Error running Lighthouse on ${url}:`, error);
      } finally {
        if (chromeInstance) {
          await chromeInstance.kill();
        }
      }
    }

    // Fetch and parse the sitemap XML
    async function fetchSitemap(url) {
      try {
        const response = await axios.get(url);
        const parser = new xml2js.Parser();
        const sitemap = await parser.parseStringPromise(response.data);
        const urls = sitemap.urlset.url.map((entry) => entry.loc[0]);
        return urls;
      } catch (error) {
        console.error("Error fetching or parsing the sitemap:", error);
        return [];
      }
    }

    // Main function to fetch the sitemaps and run Lighthouse tests
    async function testWithSitemaps() {
      const sitemapUrls = [
        "https://www.rhapsodymedia.com/sitemap-0.xml",
        "https://www.rhapsodymedia.com/server-sitemap.xml",
      ];

      let combinedUrls = [];

      // Fetch URLs from each sitemap
      for (let sitemapUrl of sitemapUrls) {
        const urls = await fetchSitemap(sitemapUrl);
        combinedUrls = [...combinedUrls, ...urls];
      }

      // Remove duplicates from the combined URLs
      combinedUrls = [...new Set(combinedUrls)];

      if (combinedUrls.length === 0) {
        console.log("No URLs found in the sitemaps.");
        return;
      }

      // Run Lighthouse on all URLs sequentially
      for (const url of combinedUrls) {
        await runLighthouse(url);
      }
    }

    // Ensure the reports directory exists
    if (!fs.existsSync("./lighthouse-reports")) {
      fs.mkdirSync("./lighthouse-reports");
    }

    // Start the testing process
    await testWithSitemaps();
  } catch (error) {
    console.error("Error initializing modules:", error);
    throw error;
  }
}

// Run the initialized code
initialize().catch(console.error);

// Remove the fetchSitemap function from the global scope
