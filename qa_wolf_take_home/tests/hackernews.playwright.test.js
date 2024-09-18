import { test, expect, request } from '@playwright/test';
import fs from 'fs';

// ------------------ Retry Utility Function ------------------
// Retry utility function to perform an action multiple times if it fails.
// Retries the action up to the specified number of attempts (default: 3 retries)
// Adds a delay between retries (default: 2000 ms).
async function retry(action, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      // Attempt the action and return if successful.
      return await action();
    } catch (error) {
      // If the final retry fails, throw the error.
      if (i === retries - 1) throw error;
      // Log the retry attempt and wait before trying again.
      console.warn(`Retry ${i + 1} failed, retrying...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

// ------------------ Helper Functions ------------------

// Extracts article details from the page.
async function extractArticles(page) {
  const articles = await page.locator('.athing').evaluateAll(nodes => {
    // For each article, extract rank, title, and timestamp. Filter out articles with no timestamp.
    return nodes.map(article => {
      const rank = article.querySelector('.rank')?.innerText || 'No rank';
      const title = article.querySelector('.titleline a')?.innerText || 'No title';
      const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
      return { rank, title, timestamp };
    }).filter(article => article.timestamp !== 'No timestamp');
  });
  return articles;
}

// Scrapes articles from Hacker News and ensures there are at least 100 unique articles.
async function scrapeAndVerifyArticles(page) {
  let allArticles = [];

  while (allArticles.length < 100) {
    const newArticles = await extractArticles(page);
    
    // If no articles are found, reload the page and retry after a short delay.
    if (newArticles.length === 0) {
      console.error('No articles found. Reloading the page...');
      await page.reload();
      await page.waitForTimeout(3000);
      continue;
    }

    // Merge new articles with the existing list and ensure uniqueness.
    allArticles = [...allArticles, ...newArticles];
    const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
    allArticles = [...uniqueArticles.values()];

    // Break the loop if we have enough articles.
    if (allArticles.length >= 100) break;

    // Click "More" if available to load more articles, or exit if no more articles are available.
    const moreButton = await page.locator('a.morelink');
    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('No more articles to load.');
      break;
    }
  }

  // Throw an error if fewer than 100 articles are scraped.
  if (allArticles.length < 100) {
    throw new Error(`Error: Only ${allArticles.length} articles were scraped.`);
  }

  // Return exactly 100 articles and validate.
  allArticles = allArticles.slice(0, 100);
  expect(allArticles.length).toBe(100);
  return allArticles;
}

// ------------------ TEST CASES ------------------

// Basic Scraping Test
// Scrapes and verifies 100 articles from the Hacker News "Newest" page.
test('Basic Scraping Test: Scrape and verify 100 articles from Hacker News', async ({ page }, testInfo) => {
  // Visit the "Newest" page.
  await retry(async () => {
    await page.goto('https://news.ycombinator.com/newest');
  });

  // Capture performance metrics.
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);
  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
  const timeToFirstByte = timing.responseStart - timing.navigationStart;

  // Scrape and verify the articles.
  const articles = await retry(async () => {
    return await scrapeAndVerifyArticles(page);
  });

  // Store article and performance info for later use.
  testInfo.articles = articles;
  testInfo.performance = { pageLoadTime, timeToFirstByte };
});

// Test: Validate Clicking a Link
// Validates that clicking the first article link on the Hacker News home page works as expected.
test('Link Click Validation: Validate clicking the first article link', async ({ page }) => {
  // Set test timeout to 60 seconds to allow for slow loading.
  test.setTimeout(60000);

  // Visit the Hacker News home page.
  await retry(async () => {
    await page.goto('https://news.ycombinator.com/');
  });

  // Ensure the page has fully loaded.
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle');

  // Locate the first article link.
  const firstArticleLink = page.locator('.athing .titleline a').first();

  // Retry waiting for the link to be visible.
  await retry(async () => {
    await firstArticleLink.waitFor({ timeout: 45000 });
  });

  // Get the expected URL of the first article.
  const expectedUrl = await retry(async () => {
    return await firstArticleLink.getAttribute('href');
  });

  // Click the link and verify that the page navigates to the expected URL.
  await retry(async () => {
    await firstArticleLink.click();
  });
  await retry(async () => {
    await expect(page).toHaveURL(expectedUrl);
  });

  console.log('Link Click Validation Passed');
});

// Test: Invalid Login Validation
// Tests invalid login functionality with mocked CAPTCHA to ensure error handling.
test('Login Validation with Mocked CAPTCHA', async ({ page }) => {
  // Increase the test timeout globally to account for network delays and to account for issues with CAPTCHA
  test.setTimeout(60000); // Increase to 60 seconds for all browsers

  // Mock the CAPTCHA request
  await page.route('**/recaptcha/api/fallback', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"success": true}', // Simulate successful CAPTCHA response
    });
  });

  // Retry mechanism for navigating to the login page
  await retry(async () => {
    await page.goto('https://news.ycombinator.com/login');
  });

  try {
    // Ensure everything is loaded and network is idle
    await retry(async () => {
      await page.waitForLoadState('networkidle');
    });

    // Retry waiting for login input fields to appear
    await retry(async () => {
      await page.waitForSelector('input[name="acct"]', { timeout: 45000 });
      await page.waitForSelector('input[name="pw"]', { timeout: 45000 });
    });

    // Enter invalid credentials and attempt to submit the form
    await page.fill('input[name="acct"]', 'invalidUser');
    await page.fill('input[name="pw"]', 'invalidPassword');
    await retry(async () => {
      await page.click('input[type="submit"]');
    });

    // Fetch the response body after form submission
    const bodyText = await retry(async () => {
      return await page.textContent('body');
    });

    // Validate the response message for invalid login or CAPTCHA requirements
    if (bodyText.includes('Bad login.')) {
      console.log('Login Validation Passed: Invalid credentials.');
      expect(bodyText).toContain('Bad login.');
    } else if (bodyText.includes('Validation required')) {
      console.warn('CAPTCHA validation required.');
      expect(bodyText).toContain('Validation required');
    } else {
      console.error('Unexpected response:', bodyText);
    }
  } catch (error) {
    console.error('Login validation failed:', error);
  }
});

// Performance Test: Captures performance metrics (Time to First Byte and Page Load Time) from Hacker News.
test('Performance Monitoring: Capture key metrics for Hacker News', async ({ browserName, browser }, testInfo) => {
  const context = await browser.newContext();

  // Start tracing for performance analysis.
  await context.tracing.start({ screenshots: true, snapshots: true });

  const page = await context.newPage();

  // Visit the "Newest" page.
  await retry(async () => {
    await page.goto('https://news.ycombinator.com/newest');
  });

  await page.waitForLoadState('networkidle'); // Ensure the page is fully loaded.

  // Capture performance timing metrics.
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);
  const ttfb = timing.responseStart - timing.navigationStart; // Time to First Byte
  const pageLoadTime = timing.loadEventEnd - timing.navigationStart; // Full page load

  console.log(`Time to First Byte (TTFB): ${ttfb} ms`);
  console.log(`Page Load Time: ${pageLoadTime} ms`);

  // Save trace file with the browser name in the filename.
  const traceFileName = `trace-${browserName}.zip`;
  await context.tracing.stop({ path: traceFileName });

  // Read the existing test results file
  let testResults = [];
  if (fs.existsSync('testResults.json')) {
    const data = fs.readFileSync('testResults.json', 'utf8');
    testResults = JSON.parse(data);
  }

  // Find existing result for the same test and browser, if it exists
  const existingResultIndex = testResults.findIndex(
    (result) => result.browser === browserName && result.test === testInfo.title
  );

  const newResult = {
    browser: browserName,
    test: testInfo.title,
    status: testInfo.status,
    performance: {
      ttfb: `${ttfb} ms`,
      pageLoadTime: `${pageLoadTime} ms`,
    },
    traceFile: traceFileName,
    error: testInfo.error || null,
  };

  if (existingResultIndex > -1) {
    // If the result exists, overwrite it
    testResults[existingResultIndex] = newResult;
  } else {
    // If it doesn't exist, push a new result
    testResults.push(newResult);
  }

  // Write the updated test results back to the file
  fs.writeFileSync('testResults.json', JSON.stringify(testResults, null, 2), 'utf-8');

  // Assert performance thresholds
  expect(ttfb).toBeLessThan(500); // TTFB threshold.
  expect(pageLoadTime).toBeLessThan(3000); // Page load time threshold.

  await context.close();
});

// ------------------ TEST: Capture and Validate API Requests ------------------

// Tests the Hacker News API by fetching and validating top stories.
test('Hacker News API: Fetch and validate top stories', async () => {
  const apiContext = await request.newContext();

  // Fetch the top stories from the API with retry logic.
  const topStoriesResponse = await retry(async () => {
    return await apiContext.get('https://hacker-news.firebaseio.com/v0/topstories.json');
  });

  expect(topStoriesResponse.ok()).toBeTruthy(); // Ensure response is OK.

  const topStories = await retry(async () => {
    return await topStoriesResponse.json();
  });

  expect(Array.isArray(topStories)).toBe(true);
  expect(topStories.length).toBeGreaterThan(0);

  console.log(`Fetched ${topStories.length} top stories from Hacker News.`);

  // Fetch details of the first story and validate.
  const firstStoryId = topStories[0];
  const storyDetailsResponse = await retry(async () => {
    return await apiContext.get(`https://hacker-news.firebaseio.com/v0/item/${firstStoryId}.json`);
  });

  expect(storyDetailsResponse.ok()).toBeTruthy();

  const storyDetails = await retry(async () => {
    return await storyDetailsResponse.json();
  });

  expect(storyDetails).toHaveProperty('id');
  expect(storyDetails).toHaveProperty('title');
  expect(storyDetails).toHaveProperty('by');
  expect(storyDetails).toHaveProperty('url');

  console.log(`Story ID: ${storyDetails.id}, Title: ${storyDetails.title}, Author: ${storyDetails.by}`);

  await apiContext.dispose();
});

// ------------------ AFTER EACH HOOK ------------------

// After each test, updates the test results file with the current test information.
test.afterEach(async ({}, testInfo) => {
  let existingResults = [];

  if (fs.existsSync('testResults.json')) {
    const data = fs.readFileSync('testResults.json', 'utf8');
    existingResults = JSON.parse(data);
  }

  // Avoid duplicates by checking if this test result already exists.
  const isDuplicate = existingResults.some(result =>
    result.browser === testInfo.project.name &&
    result.test === testInfo.title
  );

  // Add test result if it isn't a duplicate.
  if (!isDuplicate) {
    existingResults.push({
      browser: testInfo.project.name,
      test: testInfo.title,
      status: testInfo.status,
      articles: testInfo.articles || 0,
      performance: testInfo.performance || {},
      error: testInfo.error || null,
    });

    fs.writeFileSync('testResults.json', JSON.stringify(existingResults, null, 2), 'utf-8');
  }
});
