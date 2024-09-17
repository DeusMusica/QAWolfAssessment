const { chromium } = require('playwright');

describe('Hacker News Sorting Test', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto('https://news.ycombinator.com/newest');
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should check if the first 100 articles are sorted by timestamp', async () => {
    let articlesData = [];

    // Helper function to load more articles by clicking the "More" button
    async function loadMoreArticles() {
      const moreButton = await page.$('a.morelink');
      if (moreButton) {
        await moreButton.click();
        await page.waitForTimeout(2000); // Wait for articles to load
      }
    }

    // Loop until we collect at least 100 articles
    while (articlesData.length < 100) {
      // Scrape articles on the current page
      const newArticles = await page.evaluate(() => {
        const articles = Array.from(document.querySelectorAll('.athing'));
        return articles.map(article => {
          const rank = article.querySelector('.rank')?.innerText || 'No rank';
          const title = article.querySelector('.titleline a')?.innerText || 'No title';
          const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
          return { rank, title, timestamp };
        }).filter(article => article.timestamp !== 'No timestamp');
      });

      articlesData = [...articlesData, ...newArticles];
      articlesData = [...new Set(articlesData.map(a => JSON.stringify(a)))].map(a => JSON.parse(a)); // Remove duplicates

      // Load more articles if fewer than 100 articles have been collected
      if (articlesData.length < 100) {
        await loadMoreArticles();
      }
    }

    expect(articlesData.length).toBeGreaterThanOrEqual(100);

    // Check if articles are sorted from newest to oldest by timestamp
    const isSorted = articlesData.every((article, index, arr) => {
      return index === 0 || new Date(arr[index - 1].timestamp) >= new Date(article.timestamp);
    });

    expect(isSorted).toBe(true);
  });
});

describe('Hacker News Sorting Test with Parallel Execution', () => {
  let browser;
  let pages = [];

  beforeAll(async () => {
    browser = await chromium.launch();
    const context = await browser.newContext();

    // Create multiple pages to scrape in parallel (e.g., 3 pages)
    for (let i = 0; i < 3; i++) {
      const page = await context.newPage();
      await page.goto('https://news.ycombinator.com/newest');
      pages.push(page);
    }
  });

  afterAll(async () => {
    // Close all pages
    await Promise.all(pages.map(page => page.close()));
    await browser.close();
  });

  // Helper function to scrape articles on a single page
  async function scrapeArticles(page) {
    let articlesData = [];

    while (articlesData.length < 100) {
      const newArticles = await page.evaluate(() => {
        const articles = Array.from(document.querySelectorAll('.athing'));
        return articles.map(article => {
          const rank = article.querySelector('.rank')?.innerText || 'No rank';
          const title = article.querySelector('.titleline a')?.innerText || 'No title';
          const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
          return { rank, title, timestamp };
        }).filter(article => article.timestamp !== 'No timestamp'); // Filter out articles with no timestamp
      });

      articlesData = [...articlesData, ...newArticles];
      articlesData = [...new Set(articlesData.map(a => JSON.stringify(a)))].map(a => JSON.parse(a)); // Ensure uniqueness

      if (articlesData.length < 100) {
        const moreButton = await page.$('a.morelink');
        if (moreButton) {
          await moreButton.click();
          await page.waitForTimeout(2000); // Wait for articles to load
        } else {
          break; // No more articles to load
        }
      }
    }

    return articlesData.slice(0, 100); // Limit to 100 articles
  }

  test('should scrape 100 articles in parallel and check sorting', async () => {
    let allArticlesData = [];

    // Scrape articles in parallel across multiple pages
    const scrapedArticles = await Promise.all(pages.map(page => scrapeArticles(page)));

    // Combine all articles from the parallel scrapes
    scrapedArticles.forEach(articles => {
      allArticlesData = [...allArticlesData, ...articles];
    });

    // Ensure there are 100 unique articles
    allArticlesData = [...new Set(allArticlesData.map(a => JSON.stringify(a)))].map(a => JSON.parse(a)); // Ensure uniqueness
    allArticlesData = allArticlesData.slice(0, 100); // Keep only the first 100

    expect(allArticlesData.length).toBe(100);

    // Check if the articles are sorted correctly by timestamp
    const isSorted = allArticlesData.every((article, index, arr) => {
      return index === 0 || new Date(arr[index - 1].timestamp) >= new Date(article.timestamp);
    });

    expect(isSorted).toBe(true);
  });
});

describe('Hacker News Sorting Test with Pagination', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto('https://news.ycombinator.com/newest');
  });

  afterAll(async () => {
    await browser.close();
  });

  // Helper function to scrape articles from the current page
  async function scrapeArticles(page) {
    const articles = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.athing')).map(article => {
        const rank = article.querySelector('.rank')?.innerText || 'No rank';
        const title = article.querySelector('.titleline a')?.innerText || 'No title';
        const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
        return { rank, title, timestamp };
      }).filter(article => article.timestamp !== 'No timestamp'); // Filter out any articles missing timestamps
    });
    return articles;
  }

  // Helper function to load more articles by clicking the "More" button
  async function loadMoreArticles(page) {
    const moreButton = await page.$('a.morelink');
    if (moreButton) {
      await moreButton.click();
      await page.waitForTimeout(2000); // Wait for the new articles to load
    }
  }

  test('should scrape 100 articles across multiple pages and check sorting', async () => {
    let allArticlesData = [];

    // Loop to load articles until we have at least 100
    while (allArticlesData.length < 100) {
      // Scrape the articles from the current page
      const newArticles = await scrapeArticles(page);

      // Combine the new articles with the previous ones and ensure uniqueness
      allArticlesData = [...allArticlesData, ...newArticles];
      allArticlesData = [...new Set(allArticlesData.map(a => JSON.stringify(a)))].map(a => JSON.parse(a)); // Ensure uniqueness

      // If we haven't collected enough articles, load more
      if (allArticlesData.length < 100) {
        await loadMoreArticles(page);
      }
    }

    // Limit to the first 100 articles
    allArticlesData = allArticlesData.slice(0, 100);

    // Ensure we have 100 articles
    expect(allArticlesData.length).toBe(100);

    // Check if the articles are sorted correctly by timestamp (newest to oldest)
    const isSorted = allArticlesData.every((article, index, arr) => {
      return index === 0 || new Date(arr[index - 1].timestamp) >= new Date(article.timestamp);
    });

    expect(isSorted).toBe(true);
  });
});

