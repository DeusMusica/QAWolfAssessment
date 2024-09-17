import { test, expect } from '@playwright/test';
import fs from 'fs';

// ------------------ Helper Functions ------------------

/**
 * Function to extract articles on the current page.
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
 * Function to load more articles by clicking the "More" button.
 */
async function loadMoreArticles(page) {
  const moreButton = page.locator('a.morelink');
  if (await moreButton.isVisible()) {
    await moreButton.click();
    await page.waitForTimeout(2000); // Wait for network idle state
  } else {
    throw new Error('No More button found');  // Throw an error if the button is not visible
  }
}

/**
 * Generic function to scrape and verify 100 articles from Hacker News.
 */
async function scrapeAndVerifyArticles(page) {
  let allArticles = [];

  // Loop to collect at least 100 articles
  while (allArticles.length < 100) {
    // Extract articles on the current page
    const newArticles = await extractArticles(page);
    if (newArticles.length === 0) {
      console.error("No articles were found on this page, reloading...");
      await page.reload();
      await page.waitForTimeout(3000); // Give it some time to load
      continue; // Retry if no articles were found
    }

    allArticles = [...allArticles, ...newArticles];

    // Remove duplicates to ensure article uniqueness
    const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
    allArticles = [...uniqueArticles.values()];

    // Break the loop if we already have 100 articles
    if (allArticles.length >= 100) break;

    // Check if the "More" button exists
    const moreButton = await page.locator('a.morelink');
    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(2000); // Wait for network idle state
    } else {
      console.log("No 'More' button found, stopping further article loading.");
      break; // Stop if there is no "More" button, meaning no more articles to load
    }
  }

  // Ensure we have exactly 100 articles
  if (allArticles.length < 100) {
    throw new Error(`Failed to collect 100 articles. Only got ${allArticles.length} articles.`);
  }

  allArticles = allArticles.slice(0, 100);  // Limit to first 100 articles
  expect(allArticles.length).toBe(100);  // Perform the expect check
  return allArticles;
}

// ------------------ TEST CASES ------------------

/**
 * Basic Scraping Test: Scrape and verify 100 articles from Hacker News.
 */
test('Basic Scraping Test: Scrape and verify 100 articles from Hacker News', async ({ page }, testInfo) => {
  await page.goto('https://news.ycombinator.com/newest');

  // Log performance timing from the page
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);

  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
  const timeToFirstByte = timing.responseStart - timing.navigationStart;

  const articles = await scrapeAndVerifyArticles(page);

  // Store performance and article count to testInfo for globalTeardown
  testInfo.articles = articles.length;
  testInfo.performance = { pageLoadTime, timeToFirstByte };
});

/**
 * Basic Scraping Test with Error Handling: Scrape and verify 100 articles from Hacker News.
 */
test('Basic Scraping Test with Error Handling: Scrape and verify 100 articles from Hacker News', async ({ page }, testInfo) => {
  try {
    await page.goto('https://news.ycombinator.com/newest');

    // Log performance timing from the page
    const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
    const timing = JSON.parse(performanceTiming);

    const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
    const timeToFirstByte = timing.responseStart - timing.navigationStart;

    const articles = await scrapeAndVerifyArticles(page);

    // Store performance and article count to testInfo for globalTeardown
    testInfo.articles = articles.length;
    testInfo.performance = { pageLoadTime, timeToFirstByte };
  } catch (error) {
    console.error("Test failed with error:", error);
    throw error;  // Fail the test if there is any error
  }
});


/**
 * Performance Monitoring Test: Scrape and verify 100 articles from Hacker News with Performance Logging.
 */
test('Performance Monitoring Test: Scrape and verify 100 articles from Hacker News with Performance Logging', async ({ page }, testInfo) => {
  await page.goto('https://news.ycombinator.com/newest');

  // Log performance timing from the page
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);

  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
  const domContentLoadedTime = timing.domContentLoadedEventEnd - timing.navigationStart;
  const timeToFirstByte = timing.responseStart - timing.navigationStart;

  const articles = await scrapeAndVerifyArticles(page);

  // Adding performance and article count to testInfo for tracking, ensuring no duplication
  if (!testInfo.articles) {
    testInfo.articles = articles.length;
    testInfo.performance = { pageLoadTime, domContentLoadedTime, timeToFirstByte };
  }
});

// ------------------ AFTER EACH HOOK ------------------

/**
 * afterEach hook to accumulate results and save them to a JSON file after each test.
 */
test.afterEach(async ({}, testInfo) => {
  // Read the existing test results from the file, if it exists
  let existingResults = [];

  if (fs.existsSync('testResults.json')) {
    const data = fs.readFileSync('testResults.json', 'utf8');
    existingResults = JSON.parse(data);
  }

  // Check if the current test result is already present
  const isDuplicate = existingResults.some(result =>
    result.browser === testInfo.project.name &&
    result.test === testInfo.title
  );

  if (!isDuplicate) {
    // Add the current test result to the existing results if it's not a duplicate
    existingResults.push({
      browser: testInfo.project.name,   // Get the browser name
      test: testInfo.title,             // Get the test name
      status: testInfo.status,          // Test passed/failed
      articles: testInfo.articles || 0, // Number of articles scraped
      performance: testInfo.performance || {}, // Performance metrics if available
      error: testInfo.error || null     // Any error during the test
    });
  
    // Write the updated results back to the file
    fs.writeFileSync('testResults.json', JSON.stringify(existingResults, null, 2), 'utf-8');
  }
});
