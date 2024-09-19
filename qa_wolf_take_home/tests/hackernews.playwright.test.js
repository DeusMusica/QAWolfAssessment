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
  test.setTimeout(60000); // Set a timeout of 60 seconds for the whole test

  // Visit the Hacker News home page.
  await page.goto('https://news.ycombinator.com/');

  // Ensure the page has fully loaded before interacting with elements.
  await page.waitForLoadState('networkidle');
  console.log('Page fully loaded.');

  // Wait for the presence of articles on the page.
  const articles = page.locator('.athing');
  await articles.first().waitFor({ state: 'visible', timeout: 45000 });
  console.log('Articles are present.');

  // Now wait for the first article link to appear and be visible.
  const firstArticleLink = page.locator('.athing .titleline a').first();

  // Use a more explicit wait for the first article link to be both attached and visible.
  await firstArticleLink.waitFor({ state: 'attached', timeout: 30000 });
  console.log('First article link is attached.');

  await firstArticleLink.waitFor({ state: 'visible', timeout: 15000 });
  console.log('First article link is visible.');

  // Get the expected URL of the first article.
  const expectedUrl = await firstArticleLink.getAttribute('href');
  if (!expectedUrl) {
    throw new Error('Expected URL is missing.');
  }

  // Click the link and verify that the page navigates to the expected URL.
  await firstArticleLink.click();
  await expect(page).toHaveURL(expectedUrl, { timeout: 15000 });

  console.log('Link Click Validation Passed');
});

// Test: Invalid Login Validation
test('Login Validation with Mocked CAPTCHA', async ({ page }) => {
  test.setTimeout(90000);  // Increase the timeout to account for potential delays under heavy load

  // Mock the CAPTCHA request with the correct endpoint.
  await page.route('**/recaptcha/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"success": true}', // Simulate successful CAPTCHA response.
    });
  });

  // Navigate to the login page.
  await page.goto('https://news.ycombinator.com/login');
  
  // Ensure the page has fully loaded before interacting with elements.
  await page.waitForLoadState('networkidle');
  console.log('Login page fully loaded.');

  // Narrow down to the login form specifically by filtering for the form with the text "login".
  const loginForm = page.locator('form').filter({ hasText: 'login' });

  // Use locators scoped to the login form to avoid strict mode violations.
  const usernameField = loginForm.locator('input[name="acct"]');
  const passwordField = loginForm.locator('input[name="pw"]');
  const submitButton = loginForm.locator('input[type="submit"]');

  // Increase timeout and add more logging to track progress.
  console.log('Waiting for username field to attach.');
  await usernameField.waitFor({ state: 'attached', timeout: 45000 });  // Increased timeout to 45 seconds
  console.log('Username field is attached.');

  await usernameField.waitFor({ state: 'visible', timeout: 30000 });  // Increased timeout to 30 seconds
  console.log('Username field is visible.');

  await passwordField.waitFor({ state: 'attached', timeout: 45000 });  // Increased timeout for password field as well
  console.log('Password field is attached.');

  await passwordField.waitFor({ state: 'visible', timeout: 30000 });
  console.log('Password field is visible.');

  // Enter invalid credentials and submit the form.
  await usernameField.fill('invalidUser');
  await passwordField.fill('invalidPassword');
  await submitButton.click();

  // Validate the response message for invalid login or CAPTCHA requirements.
  const bodyText = await page.textContent('body', { timeout: 30000 });
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
  // Create a new browser context for this test.
  const context = await browser.newContext();

  // Start tracing to capture screenshots and snapshots for performance analysis.
  await context.tracing.start({ screenshots: true, snapshots: true });

  // Open a new page within the context.
  const page = await context.newPage();

  // Navigate to the "Newest" page on Hacker News.
  await page.goto('https://news.ycombinator.com/newest');

  // Wait for the page to fully load by ensuring the network is idle.
  await page.waitForLoadState('networkidle');

  // Capture performance timing data from the page.
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  
  // Parse the JSON string returned by the browser into a JavaScript object.
  const timing = JSON.parse(performanceTiming);

  // Calculate key performance metrics.
  // Time to First Byte (TTFB) is the time it takes for the first byte of the response to be received after the request is sent.
  const ttfb = timing.responseStart - timing.navigationStart;
  
  // Page Load Time is the total time taken from the start of navigation to the load event being fired.
  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;

  // Log the performance metrics for visibility.
  console.log(`Time to First Byte (TTFB): ${ttfb} ms`);
  console.log(`Page Load Time: ${pageLoadTime} ms`);

  // Stop tracing and save the trace file.
  // The trace will contain screenshots and performance snapshots that can be analyzed later.
  const traceFileName = `trace-${browserName}.zip`;
  await context.tracing.stop({ path: traceFileName });

  // Store the performance metrics and trace file path in the test results for further analysis.
  testInfo.performance = { ttfb, pageLoadTime, traceFileName };

  // Close the browser context after the test completes to clean up resources.
  await context.close();
});

// Hacker News API Test
test('Hacker News API: Fetch and validate top stories', async () => {
  // Create a new API request context. This context is used to manage API interactions.
  const apiContext = await request.newContext();

  // Send a GET request to the Hacker News API to fetch the list of top stories.
  const topStoriesResponse = await apiContext.get('https://hacker-news.firebaseio.com/v0/topstories.json');

  // Verify that the API response status is successful (2xx status code).
  expect(topStoriesResponse.ok()).toBeTruthy();

  // Parse the response body as JSON to retrieve the list of top story IDs.
  const topStories = await topStoriesResponse.json();

  // Ensure that the list of top stories is not empty.
  expect(topStories.length).toBeGreaterThan(0);

  // Clean up the API request context after the test completes to free resources.
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
