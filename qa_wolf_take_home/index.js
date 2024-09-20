import { chromium } from 'playwright';
import fs from 'fs';

/**
 * Clicks the "More" button on the Hacker News page to load additional articles.
 * Waits for the "More" button to reattach, indicating that new articles have loaded.
 * Throws an error if the "More" button is not found, which signals the end of the article list.
 * 
 * @param {object} page - The Playwright page object representing the browser page.
 * @throws Will throw an error if the "More" button is not found on the page.
 */
async function loadAdditionalArticles(page) {
  const moreButton = page.locator('a.morelink');

  // Check if the "More" button is visible on the page
  if (await moreButton.isVisible()) {
    // Click the "More" button to load more articles
    await moreButton.click();

    // Wait for the "More" button to reappear after new articles are loaded
    await page.waitForSelector('a.morelink', { state: 'attached' });
  } else {
    // Throw an error if the button is not found, indicating no more articles to load
    throw new Error('Error: "More" button not found.');
  }
}

/**
 * Extracts article details (ID, rank, title, and timestamp) from the current Hacker News page.
 * Each article is an object with four key properties: id, rank, title, and timestamp.
 * Filters out any articles that do not contain a timestamp.
 * 
 * @param {object} page - The Playwright page object.
 * @returns {Array} - An array of article objects, each containing ID, rank, title, and timestamp.
 */
async function getArticleData(page) {
  return await page.evaluate(() => {
    // Select all articles (elements with class 'athing') from the page
    const articles = Array.from(document.querySelectorAll('.athing'));

    // Map over each article to extract its ID, rank, title, and timestamp
    return articles.map(article => {
      const id = article.getAttribute('id'); // Unique ID of the article
      const rank = article.querySelector('.rank')?.innerText || 'No rank'; // Article rank
      const titleElement = article.querySelector('.titleline a'); // Title element
      const title = titleElement ? titleElement.innerText : 'No title'; // Article title
      const timeElement = article.nextElementSibling?.querySelector('.age'); // Timestamp element
      const timestamp = timeElement ? timeElement.innerText : 'No timestamp'; // Article timestamp

      // Return the article data as an object
      return { id, rank, title, timestamp };
    }).filter(article => article.timestamp !== 'No timestamp'); // Filter out articles without a valid timestamp
  });
}

/**
 * Scrapes and collects a total of 100 articles from the "newest" page of Hacker News.
 * Ensures that the articles are sorted by their timestamp, with the most recent articles first.
 * Writes the collected article data to a JSON file for later analysis.
 */
async function collectAndValidateArticles() {
  // Launch a new Chromium browser (set headless to true if no UI is needed)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(); // Create a new browser context
  const page = await context.newPage(); // Open a new page (tab)

  // Navigate to the "newest" page of Hacker News
  await page.goto('https://news.ycombinator.com/newest');

  let articlesData = []; // Array to store all scraped article data

  // Loop until we have collected at least 100 articles
  while (articlesData.length < 100) {
    // Scrape the article data from the current page
    const newArticlesData = await getArticleData(page);
    articlesData = articlesData.concat(newArticlesData); // Append new articles to the existing list

    // Sort articles by timestamp (newest first)
    articlesData = articlesData.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Limit the number of articles to exactly 100
    if (articlesData.length >= 100) {
      articlesData = articlesData.slice(0, 100);
    }

    // If fewer than 100 articles are collected, load more articles
    if (articlesData.length < 100) {
      await loadAdditionalArticles(page);
    }
  }

  // Write the scraped article data to a JSON file for later use
  fs.writeFileSync('scraped-articles.json', JSON.stringify(articlesData, null, 2), 'utf-8');

  console.log('Successfully scraped the first 100 articles.');

  // Close the browser when scraping is complete
  await browser.close();
}

// Execute the article scraping function
(async () => {
  await collectAndValidateArticles();
})();
