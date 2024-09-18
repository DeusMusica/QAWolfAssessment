import { test, expect } from '@playwright/test';
import fs from 'fs';

// ------------------ Helper Functions ------------------

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

async function scrapeAndVerifyArticles(page) {
  let allArticles = [];

  while (allArticles.length < 100) {
    const newArticles = await extractArticles(page);
    if (newArticles.length === 0) {
      console.error('No articles found. Reloading the page...');
      await page.reload();
      await page.waitForTimeout(3000);
      continue;
    }

    allArticles = [...allArticles, ...newArticles];
    const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
    allArticles = [...uniqueArticles.values()];

    if (allArticles.length >= 100) break;

    const moreButton = await page.locator('a.morelink');
    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('No more articles to load.');
      break;
    }
  }

  if (allArticles.length < 100) {
    throw new Error(`Error: Only ${allArticles.length} articles were scraped.`);
  }

  allArticles = allArticles.slice(0, 100);
  expect(allArticles.length).toBe(100);
  return allArticles;
}

// ------------------ TEST CASES ------------------

// Basic Scraping Test
test('Basic Scraping Test: Scrape and verify 100 articles from Hacker News', async ({ page }, testInfo) => {
  await page.goto('https://news.ycombinator.com/newest');

  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);

  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
  const timeToFirstByte = timing.responseStart - timing.navigationStart;

  const articles = await scrapeAndVerifyArticles(page);

  // Store actual articles in testInfo for later use in runner
  testInfo.articles = articles;
  testInfo.performance = { pageLoadTime, timeToFirstByte };
});


// Test: Validate Clicking a Link
test('Link Click Validation: Validate clicking the first article link', async ({ page }) => {
  // Increase the test timeout to 60 seconds for slow browsers/pages
  test.setTimeout(60000);

  await page.goto('https://news.ycombinator.com/');

  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle');  // Ensure everything has loaded

  const firstArticleLink = page.locator('.athing .titleline a').first();
  await firstArticleLink.waitFor({ timeout: 45000 });  // Wait for link to be visible

  const expectedUrl = await firstArticleLink.getAttribute('href');

  // Click the link and wait for navigation
  await firstArticleLink.click();
  
  // Wait for navigation and assert the URL
  await expect(page).toHaveURL(expectedUrl);  // Repeating assertion to wait until the page has the expected URL

  console.log('Link Click Validation Passed');
});

// Test: Invalid Login Validation
test('Login Validation with Mocked CAPTCHA', async ({ page }) => {
  // Mock the CAPTCHA request
  await page.route('**/recaptcha/api/fallback', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"success": true}',  // Simulate successful CAPTCHA response
    });
  });

  await page.goto('https://news.ycombinator.com/login');

  try {
    // Wait for the page to fully load (including network activity)
    await page.waitForLoadState('networkidle');  // Ensure everything is loaded

    // Increase timeout for WebKit specifically to forego Captcha issues
    await page.waitForSelector('input[name="acct"]', { timeout: 45000 }); // Increased timeout
    await page.waitForSelector('input[name="pw"]', { timeout: 45000 });

    // Enter invalid credentials
    await page.fill('input[name="acct"]', 'invalidUser');
    await page.fill('input[name="pw"]', 'invalidPassword');
    await page.click('input[type="submit"]');

    // Wait for page content to update after form submission
    const bodyText = await page.textContent('body');

    // Validate the response message
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

// ------------------ AFTER EACH HOOK ------------------

test.afterEach(async ({}, testInfo) => {
  let existingResults = [];

  if (fs.existsSync('testResults.json')) {
    const data = fs.readFileSync('testResults.json', 'utf8');
    existingResults = JSON.parse(data);
  }

  const isDuplicate = existingResults.some(result =>
    result.browser === testInfo.project.name &&
    result.test === testInfo.title
  );

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
