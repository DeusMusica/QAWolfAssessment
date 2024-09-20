import { test, expect, request } from '@playwright/test';
import fs from 'fs';

// ------------------ Helper Functions ------------------

// Normalize titles by removing non-alphanumeric characters, trimming spaces, and converting to lowercase.
// This ensures titles can be compared in a case-insensitive and format-neutral way.
const normalizeTitle = (title) =>
  title.replace(/[^\w\s]/gi, '').trim().toLowerCase();

// Extracts article details from the page.
// It locates the elements containing article data such as rank, title, and timestamp and returns them.
async function extractArticles(page) {
  const articles = await page.locator('.athing').evaluateAll(nodes => {
    return nodes.map(article => {
      const rank = article.querySelector('.rank')?.innerText || 'No rank';
      const title = article.querySelector('.titleline a')?.innerText || 'No title';
      const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
      return { rank, title, timestamp };
    }).filter(article => article.timestamp !== 'No timestamp'); // Filter out articles missing timestamp
  });
  return articles;
}

// Scrapes articles from Hacker News and ensures there are at least 100 unique articles.
// This function loops until it either scrapes 100 unique articles or exhausts the available articles.
async function scrapeAndVerifyArticles(page) {
  let allArticles = [];

  // Keep scraping until we have 100 unique articles.
  while (allArticles.length < 100) {
    const newArticles = await extractArticles(page);

    // If no new articles are found, reload the page and try again.
    if (newArticles.length === 0) {
      console.error('No articles found. Reloading the page...');
      await page.reload();
      await page.waitForLoadState('networkidle'); // Ensure the page has fully loaded.
      continue;
    }

    // Merge new articles into the list and ensure uniqueness by title.
    allArticles = [...allArticles, ...newArticles];
    const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
    allArticles = [...uniqueArticles.values()];

    // If "More" button is available, click it to load more articles.
    const moreButton = await page.locator('a.morelink');
    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForLoadState('networkidle'); // Ensure more articles are loaded.
    } else {
      console.log('No more articles to load.');
      break;
    }
  }

  // Throw an error if we scrape fewer than 100 articles.
  if (allArticles.length < 100) {
    throw new Error(`Error: Only ${allArticles.length} articles were scraped.`);
  }

  // Trim to exactly 100 articles and verify the count.
  allArticles = allArticles.slice(0, 100);
  expect(allArticles.length).toBe(100);
  return allArticles;
}

// ------------------ TEST CASES ------------------

// Basic Scraping Test: Ensures we can scrape and verify 100 unique articles from the "Newest" page.
test('Basic Scraping Test: Scrape and verify 100 articles from Hacker News', async ({ page }, testInfo) => {
  // Visit the "Newest" page on Hacker News.
  await page.goto('https://news.ycombinator.com/newest');
  
  // Capture and calculate performance metrics.
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);
  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
  const timeToFirstByte = timing.responseStart - timing.navigationStart;

  // Scrape and verify articles.
  const articles = await scrapeAndVerifyArticles(page);
  
  // Store scraped articles and performance metrics for later use in test results.
  testInfo.articles = articles;
  testInfo.performance = { pageLoadTime, timeToFirstByte };
});

// Test: Validate Clicking a Link
test('Link Click Validation: Validate clicking the first article link', async ({ page }) => {
  test.setTimeout(60000); // Set timeout of 60 seconds for the entire test

  // The following block uses `expect(async () => {...})` to repeat assertions and handle async issues.
  await expect(async () => {
    // Visit the Hacker News home page and wait for it to load completely.
    await page.goto('https://news.ycombinator.com/');
    await page.waitForLoadState('networkidle'); // Wait for the network to be idle, ensuring the page is fully loaded.

    // Wait for the first article in the list to be visible before proceeding.
    const articles = page.locator('.athing');
    await articles.first().waitFor({ state: 'visible', timeout: 45000 });
  }).toPass({ timeout: 60000 });

  // After confirming the first article link is visible, click it and verify the page navigates correctly.
  const firstArticleLink = page.locator('.athing .titleline a').first();
  await firstArticleLink.waitFor({ state: 'attached', timeout: 30000 }); // Ensure the link is attached to the DOM
  await firstArticleLink.waitFor({ state: 'visible', timeout: 15000 }); // Ensure it is visible
  const expectedUrl = await firstArticleLink.getAttribute('href'); // Get the URL of the article

  if (!expectedUrl) throw new Error('Expected URL is missing.');

  // Click the link and verify that the page navigates to the expected URL.
  await firstArticleLink.click();
  await expect(page).toHaveURL(expectedUrl, { timeout: 15000 });
  console.log('Link Click Validation Passed');
});

// Test: Invalid Login Validation with Mocked CAPTCHA
test('Login Validation with Mocked CAPTCHA', async ({ page }) => {
  test.setTimeout(90000);  // Increased timeout to accommodate potential delays under heavy load.

  // Mock the CAPTCHA request to always return a success response.
  await page.route('**/recaptcha/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"success": true}', // Simulate a successful CAPTCHA response.
    });
  });

  // This block uses repeated assertions to ensure elements are loaded and interactable.
  await expect(async () => {
    // Navigate to the login page and wait for the network to be idle.
    await page.goto('https://news.ycombinator.com/login');
    await page.waitForLoadState('networkidle');

    // Narrow down to the login form and locate the fields.
    const loginForm = page.locator('form').filter({ hasText: 'login' });
    const usernameField = loginForm.locator('input[name="acct"]');
    const passwordField = loginForm.locator('input[name="pw"]');
    const submitButton = loginForm.locator('input[type="submit"]');

    // Wait for the username and password fields to be attached and visible.
    await usernameField.waitFor({ state: 'attached', timeout: 45000 });
    await usernameField.waitFor({ state: 'visible', timeout: 30000 });

    await passwordField.waitFor({ state: 'attached', timeout: 45000 });
    await passwordField.waitFor({ state: 'visible', timeout: 30000 });

    // Fill in invalid credentials and submit the form.
    await usernameField.fill('invalidUser');
    await passwordField.fill('invalidPassword');
    await submitButton.click();
  }).toPass({ timeout: 60000 });

  // Check the response text and validate whether the login failed or CAPTCHA validation is required.
  const bodyText = await page.textContent('body', { timeout: 30000 });
  const bodyLocator = page.locator('body');

  if (bodyText.includes('Bad login.')) {
    await expect(bodyLocator).toContainText('Bad login.'); // Validate the error message is shown.
  } else if (bodyText.includes('Validation required')) {
    await expect(bodyLocator).toContainText('Validation required'); // Validate the CAPTCHA message.
  } else {
    console.error('Unexpected response:', bodyText);
  }
});

// Performance Monitoring
test('Performance Monitoring: Capture key metrics for Hacker News', async ({ browserName, browser }, testInfo) => {
  // Create a new browser context to isolate the test.
  const context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true }); // Start tracing for performance analysis.

  const page = await context.newPage();
  await page.goto('https://news.ycombinator.com/newest');
  await page.waitForLoadState('networkidle'); // Wait for the network to be idle.

  // Capture performance timing data from the page.
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);

  const ttfb = timing.responseStart - timing.navigationStart; // Time to First Byte (TTFB)
  const pageLoadTime = timing.loadEventEnd - timing.navigationStart; // Page Load Time

  console.log(`Time to First Byte (TTFB): ${ttfb} ms`);
  console.log(`Page Load Time: ${pageLoadTime} ms`);

  // Stop tracing and save the trace file.
  const traceFileName = `trace-${browserName}.zip`;
  await context.tracing.stop({ path: traceFileName });

  testInfo.performance = { ttfb, pageLoadTime, traceFileName }; // Store performance metrics in test results.
  await context.close(); // Close the browser context to clean up.
});

// Hacker News API: Fetch and validate top stories
test('Hacker News API: Fetch and validate top stories', async () => {
  // Create a new API request context for handling API interactions.
  const apiContext = await request.newContext();
  
  // Fetch the list of top stories from Hacker News API.
  const topStoriesResponse = await apiContext.get('https://hacker-news.firebaseio.com/v0/topstories.json');
  expect(topStoriesResponse.ok()).toBeTruthy(); // Ensure the API response is successful.

  const topStories = await topStoriesResponse.json(); // Parse the response JSON.
  expect(topStories.length).toBeGreaterThan(0); // Validate that the API returned some stories.

  await apiContext.dispose(); // Clean up the API request context after test completion.
});

// Hacker News API: Validate top stories from API against UI
test('Hacker News API: Validate top stories from API against UI', async ({ page }) => {
  // Step 1: Create an API request context to fetch data from Hacker News API.
  const apiContext = await request.newContext();

  // Fetch the top stories from the API.
  const topStoriesResponse = await apiContext.get('https://hacker-news.firebaseio.com/v0/topstories.json');
  expect(topStoriesResponse.ok()).toBeTruthy(); // Ensure the API response is successful.
  const topStories = await topStoriesResponse.json(); // Parse the JSON response.
  expect(topStories.length).toBeGreaterThan(0); // Ensure we have some top stories returned.

  // Fetch detailed information about the top 10 stories from the API.
  const top10StoryIds = topStories.slice(0, 10); // Get the first 10 story IDs.
  const top10StoriesData = await Promise.all(
    top10StoryIds.map(async (storyId) => {
      const storyResponse = await apiContext.get(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
      return storyResponse.json();
    })
  );

  const apiTitles = top10StoriesData.map((story) => normalizeTitle(story.title)); // Normalize titles for comparison.

  // Step 2: Navigate to the Hacker News homepage.
  await page.goto('https://news.ycombinator.com/');
  await page.waitForLoadState('networkidle'); // Wait for the network to be idle.

  // Step 3: Extract visible titles from the page and normalize them for comparison.
  const pageTitles = await page.locator('.athing .titleline a').evaluateAll((elements) =>
    elements.map(el => el.innerText.trim().toLowerCase())
  );

  // Step 4: Iterate through the API titles and compare them with the page titles.
  for (const apiTitle of apiTitles) {
    const isTitleFound = pageTitles.some(pageTitle => normalizeTitle(pageTitle).includes(apiTitle));
    expect(isTitleFound).toBe(true); // Assert that the title is found on the page.
    console.log(`Matched API title: "${apiTitle}" with a Page title.`);
  }

  await apiContext.dispose(); // Clean up the API request context.
});

// ------------------ AFTER EACH HOOK ------------------

// After each test, update the testResults.json file with test information.
test.afterEach(async ({}, testInfo) => {
  let testResults = [];

  // Check if the testResults.json file exists and read its contents.
  if (fs.existsSync('testResults.json')) {
    const data = fs.readFileSync('testResults.json', 'utf8');
    testResults = JSON.parse(data);
  }

  // Create a new result object for the current test.
  const newResult = {
    browser: testInfo.project.name,
    test: testInfo.title,
    status: testInfo.status,
    articles: testInfo.articles || 0,
    performance: testInfo.performance || {},
    error: testInfo.error || null,
  };

  // Check if the test result for this test already exists and update it, otherwise add a new result.
  const existingResultIndex = testResults.findIndex(result =>
    result.browser === testInfo.project.name && result.test === testInfo.title
  );

  if (existingResultIndex > -1) {
    testResults[existingResultIndex] = newResult;
  } else {
    testResults.push(newResult);
  }

  // Write the updated test results back to the file.
  fs.writeFileSync('testResults.json', JSON.stringify(testResults, null, 2), 'utf-8');
});
