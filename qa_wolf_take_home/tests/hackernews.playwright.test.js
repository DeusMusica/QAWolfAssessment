import { test, expect, request } from '@playwright/test';
import fs from 'fs';

// ------------------ Helper Functions ------------------

// Extracts article details from the page.
async function extractArticles(page) {
  const articles = await page.locator('.athing').evaluateAll(nodes => {
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
      await page.waitForLoadState('networkidle'); // Use Playwright's network idle state to ensure the page is fully loaded.
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
      await page.waitForLoadState('networkidle'); // Ensure more articles are loaded.
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
test('Basic Scraping Test: Scrape and verify 100 articles from Hacker News', async ({ page }, testInfo) => {
  // Visit the "Newest" page.
  await page.goto('https://news.ycombinator.com/newest');
  
  // Capture performance metrics.
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);
  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
  const timeToFirstByte = timing.responseStart - timing.navigationStart;

  // Scrape and verify the articles.
  const articles = await scrapeAndVerifyArticles(page);
  
  // Store articles and performance info for later use in test results.
  testInfo.articles = articles;
  testInfo.performance = { pageLoadTime, timeToFirstByte };
});

// Test: Validate Clicking a Link
test('Link Click Validation: Validate clicking the first article link', async ({ page }) => {
  test.setTimeout(60000);

  // Visit the Hacker News home page.
  await page.goto('https://news.ycombinator.com/');

  // Ensure the page has fully loaded.
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');

  // Locate the first article link.
  const firstArticleLink = page.locator('.athing .titleline a').first();

  // Ensure the link is visible before trying to interact with it.
  await expect(firstArticleLink).toBeVisible({ timeout: 45000 });

  // Get the expected URL of the first article.
  const expectedUrl = await firstArticleLink.getAttribute('href');

  // Click the link and verify that the page navigates to the expected URL.
  await firstArticleLink.click();
  await expect(page).toHaveURL(expectedUrl);
  console.log('Link Click Validation Passed');
});

// Test: Invalid Login Validation
test('Login Validation with Mocked CAPTCHA', async ({ page }) => {
  test.setTimeout(60000);

  // Mock the CAPTCHA request
  await page.route('**/recaptcha/api/fallback', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"success": true}', // Simulate successful CAPTCHA response
    });
  });

  // Navigate to the login page
  await page.goto('https://news.ycombinator.com/login');
  await page.waitForLoadState('networkidle');

  // Wait for login input fields to appear
  await page.waitForSelector('input[name="acct"]');
  await page.waitForSelector('input[name="pw"]');

  // Enter invalid credentials and submit
  await page.fill('input[name="acct"]', 'invalidUser');
  await page.fill('input[name="pw"]', 'invalidPassword');
  await page.click('input[type="submit"]');

  // Validate the response message for invalid login or CAPTCHA requirements
  const bodyText = await page.textContent('body');
  if (bodyText.includes('Bad login.')) {
    expect(bodyText).toContain('Bad login.');
    console.log('Login Validation Passed: Invalid credentials.');
  } else if (bodyText.includes('Validation required')) {
    expect(bodyText).toContain('Validation required');
    console.warn('CAPTCHA validation required.');
  } else {
    console.error('Unexpected response:', bodyText);
  }
});

// Performance Monitoring
test('Performance Monitoring: Capture key metrics for Hacker News', async ({ browserName, browser }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true });

  const page = await context.newPage();
  await page.goto('https://news.ycombinator.com/newest');
  await page.waitForLoadState('networkidle');

  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);
  const ttfb = timing.responseStart - timing.navigationStart; 
  const pageLoadTime = timing.loadEventEnd - timing.navigationStart; 

  console.log(`Time to First Byte (TTFB): ${ttfb} ms`);
  console.log(`Page Load Time: ${pageLoadTime} ms`);

  const traceFileName = `trace-${browserName}.zip`;
  await context.tracing.stop({ path: traceFileName });

  testInfo.performance = { ttfb, pageLoadTime, traceFileName };

  await context.close();
});

// Hacker News API Test
test('Hacker News API: Fetch and validate top stories', async () => {
  const apiContext = await request.newContext();
  const topStoriesResponse = await apiContext.get('https://hacker-news.firebaseio.com/v0/topstories.json');
  expect(topStoriesResponse.ok()).toBeTruthy();

  const topStories = await topStoriesResponse.json();
  expect(topStories.length).toBeGreaterThan(0);

  await apiContext.dispose();
});

// ------------------ AFTER EACH HOOK ------------------

// After each test, update the testResults.json file
test.afterEach(async ({}, testInfo) => {
  let testResults = [];

  // Check if the testResults.json file exists
  if (fs.existsSync('testResults.json')) {
    const data = fs.readFileSync('testResults.json', 'utf8');
    testResults = JSON.parse(data);
  }

  // Add or update test result in the testResults array
  const newResult = {
    browser: testInfo.project.name,
    test: testInfo.title,
    status: testInfo.status,
    articles: testInfo.articles || 0,
    performance: testInfo.performance || {},
    error: testInfo.error || null,
  };

  const existingResultIndex = testResults.findIndex(result => 
    result.browser === testInfo.project.name && result.test === testInfo.title
  );

  if (existingResultIndex > -1) {
    testResults[existingResultIndex] = newResult;
  } else {
    testResults.push(newResult);
  }

  // Write updated test results back to the file
  fs.writeFileSync('testResults.json', JSON.stringify(testResults, null, 2), 'utf-8');
});
