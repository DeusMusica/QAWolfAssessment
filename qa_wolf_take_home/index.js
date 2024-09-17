import { chromium } from 'playwright';
import fs from 'fs';

/**
 * Clicks the "More" button to load additional articles.
 * @param {object} page - The Playwright page object.
 */
async function loadAdditionalArticles(page) {
  const moreButton = await page.$('a.morelink');
  if (moreButton) {
    await moreButton.click();
    // Wait for the "More" button to be attached again (next page load)
    await page.waitForSelector('a.morelink', { state: 'attached' });
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
      const id = article.getAttribute('id'); // Article ID
      const rank = article.querySelector('.rank')?.innerText || 'No rank';
      const titleElement = article.querySelector('.titleline a');
      const title = titleElement ? titleElement.innerText : 'No title';
      const timeElement = article.nextElementSibling?.querySelector('.age');
      const timestamp = timeElement ? timeElement.innerText : 'No timestamp';

      return { id, rank, title, timestamp };
    }).filter(article => article.timestamp !== 'No timestamp'); // Filter out articles with no timestamp
  });
}

/**
 * Converts relative time (e.g., '5 hours ago') into a readable format.
 * @param {string} relativeTime - The relative time string.
 * @returns {string} Elapsed time in hours or days.
 */
function calculateElapsedTime(relativeTime) {
  const currentTime = new Date();
  const timeParts = relativeTime.split(' ');
  let elapsedTime = currentTime;

  if (timeParts.includes('minute') || timeParts.includes('minutes')) {
    const minutesAgo = parseInt(timeParts[0]);
    elapsedTime = new Date(currentTime.getTime() - minutesAgo * 60000);
  } else if (timeParts.includes('hour') || timeParts.includes('hours')) {
    const hoursAgo = parseInt(timeParts[0]);
    elapsedTime = new Date(currentTime.getTime() - hoursAgo * 3600000);
  } else if (timeParts.includes('day') || timeParts.includes('days')) {
    const daysAgo = parseInt(timeParts[0]);
    elapsedTime = new Date(currentTime.getTime() - daysAgo * 86400000);
  } else if (relativeTime === 'yesterday') {
    elapsedTime = new Date(currentTime.getTime() - 24 * 3600000);
  }

  const diffMs = currentTime - elapsedTime;
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffDays >= 1) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else {
    return `${diffHrs} hour${diffHrs > 1 ? 's' : ''}`;
  }
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

  // Calculate elapsed time for each article
  articlesData = articlesData.map(article => ({
    ...article,
    elapsedTime: calculateElapsedTime(article.timestamp)
  }));

  // Write the data to a JSON file
  fs.writeFileSync('scraped-articles.json', JSON.stringify(articlesData, null, 2), 'utf-8');

  console.log('Successfully scraped the first 100 articles.');
  await browser.close();
}

// Run the script to collect articles
(async () => {
  await collectAndValidateArticles();
})();
