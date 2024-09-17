import { test, expect } from '@playwright/test';
import fs from 'fs';

// ------------------ Helper Functions ------------------

/**
 * Extract articles from the current page.
 * @param {object} page - Playwright page object.
 * @returns {Array} Array of articles with rank, title, and timestamp.
 */
async function extractArticles(page) {
  const articles = await page.locator('.athing').evaluateAll(nodes => {
    return nodes.map(article => {
      const rank = article.querySelector('.rank')?.innerText || 'No rank';
      const title = article.querySelector('.titleline a')?.innerText || 'No title';
      const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
      return { rank, title, timestamp };
    }).filter(article => article.timestamp !== 'No timestamp'); // Filter out articles with no timestamp
  });
  return articles;
}

/**
 * Load more articles by clicking the "More" button.
 * @param {object} page - Playwright page object.
 * @throws Will throw an error if the "More" button is not found.
 */
async function loadMoreArticles(page) {
  const moreButton = page.locator('a.morelink');
  if (await moreButton.isVisible()) {
    await moreButton.click();
    await page.waitForTimeout(2000); // Wait for network idle state
  } else {
    throw new Error('Error: "More" button not found on the page.');
  }
}

/**
 * Scrape and verify 100 articles from Hacker News.
 * @param {object} page - Playwright page object.
 * @returns {Array} Array of 100 articles.
 * @throws Will throw an error if fewer than 100 articles are collected.
 */
async function scrapeAndVerifyArticles(page) {
  let allArticles = [];

  // Loop to collect at least 100 articles
  while (allArticles.length < 100) {
    const newArticles = await extractArticles(page);
    if (newArticles.length === 0) {
      console.error('No articles found. Reloading the page...');
      await page.reload();
      await page.waitForTimeout(3000); // Give it time to reload
      continue; // Retry scraping
    }

    allArticles = [...allArticles, ...newArticles];

    // Remove duplicates by title to ensure uniqueness
    const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
    allArticles = [...uniqueArticles.values()];

    if (allArticles.length >= 100) break; // Exit if we have enough articles

    // Try to load more articles if available
    const moreButton = await page.locator('a.morelink');
    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(2000); // Wait for network idle state
    } else {
      console.log('No more articles to load.');
      break;
    }
  }

  if (allArticles.length < 100) {
    throw new Error(`Error: Only ${allArticles.length} articles were scraped.`);
  }

  allArticles = allArticles.slice(0, 100); // Limit to first 100 articles
  expect(allArticles.length).toBe(100); // Assert that we have exactly 100 articles
  return allArticles;
}

// ------------------ TEST CASES ------------------

/**
 * Basic Scraping Test: Scrape and verify 100 articles from Hacker News.
 */
test('Basic Scraping Test: Scrape and verify 100 articles from Hacker News', async ({ page }, testInfo) => {
  await page.goto('https://news.ycombinator.com/newest');

  // Capture performance metrics
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);

  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
  const timeToFirstByte = timing.responseStart - timing.navigationStart;

  const articles = await scrapeAndVerifyArticles(page);

  // Store performance and article count for the globalTeardown
  testInfo.articles = articles.length;
  testInfo.performance = { pageLoadTime, timeToFirstByte };
});

/**
 * Scraping Test with Error Handling: Scrape and verify 100 articles from Hacker News.
 */
test('Basic Scraping Test with Error Handling: Scrape and verify 100 articles from Hacker News', async ({ page }, testInfo) => {
  try {
    await page.goto('https://news.ycombinator.com/newest');

    const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
    const timing = JSON.parse(performanceTiming);

    const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
    const timeToFirstByte = timing.responseStart - timing.navigationStart;

    const articles = await scrapeAndVerifyArticles(page);

    testInfo.articles = articles.length;
    testInfo.performance = { pageLoadTime, timeToFirstByte };
  } catch (error) {
    console.error('Error: Test failed with error:', error);
    throw error;
  }
});

/**
 * Performance Monitoring Test: Scrape and verify 100 articles with performance logging.
 */
test('Performance Monitoring Test: Scrape and verify 100 articles from Hacker News with Performance Logging', async ({ page }, testInfo) => {
  await page.goto('https://news.ycombinator.com/newest');

  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);

  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
  const domContentLoadedTime = timing.domContentLoadedEventEnd - timing.navigationStart;
  const timeToFirstByte = timing.responseStart - timing.navigationStart;

  const articles = await scrapeAndVerifyArticles(page);

  testInfo.articles = articles.length;
  testInfo.performance = { pageLoadTime, domContentLoadedTime, timeToFirstByte };
});

// ------------------ AFTER EACH HOOK ------------------

/**
 * After each test, accumulate results and save them to a JSON file.
 */
test.afterEach(async ({}, testInfo) => {
  // Read existing test results if the file exists
  let existingResults = [];

  if (fs.existsSync('testResults.json')) {
    const data = fs.readFileSync('testResults.json', 'utf8');
    existingResults = JSON.parse(data);
  }

  // Check for duplicate results based on browser and test name
  const isDuplicate = existingResults.some(result =>
    result.browser === testInfo.project.name &&
    result.test === testInfo.title
  );

  if (!isDuplicate) {
    // Append current test results if not a duplicate
    existingResults.push({
      browser: testInfo.project.name,
      test: testInfo.title,
      status: testInfo.status,
      articles: testInfo.articles || 0,
      performance: testInfo.performance || {},
      error: testInfo.error || null,
    });

    // Write the updated results to the JSON file
    fs.writeFileSync('testResults.json', JSON.stringify(existingResults, null, 2), 'utf-8');
  }
});
