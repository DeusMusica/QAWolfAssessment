import { chromium } from 'playwright';
import fs from 'fs';

/**
 * Clicks the "More" button to load additional articles.
 * @param {object} page - The Playwright page object.
 */
async function loadAdditionalArticles(page) {
  const moreButton = page.locator('a.morelink');
  if (await moreButton.isVisible()) {
    await moreButton.click();
    await page.waitForSelector('a.morelink', { state: 'attached' });
  } else {
    throw new Error('Error: "More" button not found.');
  }
}

/**
 * Extracts article data from the current page.
 * @param {object} page - The Playwright page object.
 * @returns {Array} Array of articles with ID, rank, title, and timestamp.
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

      return { id, rank, title, timestamp };
    }).filter(article => article.timestamp !== 'No timestamp');
  });
}

/**
 * Collects and validates 100 articles from Hacker News, writes to a JSON file.
 */
async function collectAndValidateArticles() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://news.ycombinator.com/newest');
  let articlesData = [];

  while (articlesData.length < 100) {
    const newArticlesData = await getArticleData(page);
    articlesData = articlesData.concat(newArticlesData);

    // Sort articles by timestamp, newest first
    articlesData = articlesData.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Ensure we have at most 100 articles
    if (articlesData.length >= 100) {
      articlesData = articlesData.slice(0, 100);
    }

    if (articlesData.length < 100) {
      await loadAdditionalArticles(page);
    }
  }

  // Write the data to a JSON file (no elapsedTime)
  fs.writeFileSync('scraped-articles.json', JSON.stringify(articlesData, null, 2), 'utf-8');

  console.log('Successfully scraped the first 100 articles.');
  await browser.close();
}

// Run the article scraper
(async () => {
  await collectAndValidateArticles();
})();
