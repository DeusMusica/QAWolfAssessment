import { chromium } from 'playwright';
import fs from 'fs';

/**
 * Clicks the "More" button to load additional articles if it is visible on the page.
 * Waits for the "More" button to reappear to ensure that new articles are loaded.
 * @param {object} page - The Playwright page object.
 * @throws Will throw an error if the "More" button is not found.
 */
async function loadAdditionalArticles(page) {
  const moreButton = page.locator('a.morelink');

  // Check if the "More" button is visible and click it
  if (await moreButton.isVisible()) {
    await moreButton.click();

    // Wait for the button to be re-attached to the DOM, indicating more articles are loading
    await page.waitForSelector('a.morelink', { state: 'attached' });
  } else {
    throw new Error('Error: "More" button not found.');
  }
}

/**
 * Extracts article data (ID, rank, title, and timestamp) from the current page.
 * Filters out articles without a timestamp.
 * @param {object} page - The Playwright page object.
 * @returns {Array} An array of article objects containing ID, rank, title, and timestamp.
 */
async function getArticleData(page) {
  return await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('.athing'));

    return articles.map(article => {
      const id = article.getAttribute('id');
      const rank = article.querySelector('.rank')?.innerText || 'No rank';
      const titleElement = article.querySelector('.titleline a');
      const title = titleElement ? titleElement.innerText : 'No title';
      const timeElement = article.nextElementSibling?.querySelector('.age');
      const timestamp = timeElement ? timeElement.innerText : 'No timestamp';

      // Return article data as an object
      return { id, rank, title, timestamp };
    }).filter(article => article.timestamp !== 'No timestamp'); // Only return articles with a valid timestamp
  });
}

/**
 * Scrapes and validates a total of 100 articles from Hacker News, and writes the data to a JSON file.
 * Ensures that the list is sorted by the most recent articles.
 */
async function collectAndValidateArticles() {
  // Launch Chromium browser in non-headless mode (change to true if headless is preferred)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the "newest" page of Hacker News
  await page.goto('https://news.ycombinator.com/newest');

  let articlesData = [];

  // Continue scraping until 100 articles are collected
  while (articlesData.length < 100) {
    // Extract article data from the current page
    const newArticlesData = await getArticleData(page);
    articlesData = articlesData.concat(newArticlesData);

    // Sort articles by timestamp, with the newest articles first
    articlesData = articlesData.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Limit the number of articles to 100 if we have more than needed
    if (articlesData.length >= 100) {
      articlesData = articlesData.slice(0, 100);
    }

    // Load more articles if we haven't reached 100 yet
    if (articlesData.length < 100) {
      await loadAdditionalArticles(page);
    }
  }

  // Write the scraped article data to a JSON file
  fs.writeFileSync('scraped-articles.json', JSON.stringify(articlesData, null, 2), 'utf-8');

  console.log('Successfully scraped the first 100 articles.');

  // Close the browser after scraping is complete
  await browser.close();
}

// Run the article scraper
(async () => {
  await collectAndValidateArticles();
})();
