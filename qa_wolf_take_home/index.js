const { chromium } = require('playwright');

async function loadAdditionalArticles(page) {
  // Locate and click the "more" button to load additional articles
  const moreButton = await page.$('a.morelink');
  if (moreButton) {
    await moreButton.click();
    await page.waitForSelector('a.morelink', { state: 'attached' });
  }
}

async function getArticleData(page) {
  // Extract article data (Rank ID, Title, Timestamp) from the current page's articles
  return await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('.athing'));
    return articles.map(article => {
      const rank = article.querySelector('.rank')?.innerText || 'No rank'; // Get article rank
      const titleElement = article.querySelector('.titleline a'); // Updated: Get title from correct selector
      const title = titleElement ? titleElement.innerText : 'No title'; // Get article title from <a> inside <span class="titleline">
      const timeElement = article.nextElementSibling?.querySelector('.age'); // Get timestamp element
      const timestamp = timeElement ? timeElement.getAttribute('title') : 'No timestamp'; // Get timestamp
      
      return {
        rank,
        title,
        timestamp
      };
    }).filter(article => article.timestamp !== 'No timestamp'); // Filter out articles with missing timestamps
  });
}

async function collectAndValidateArticles() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://news.ycombinator.com/newest');

  let articlesData = [];

  // Continue loading articles until we have at least 100 articles
  while (articlesData.length < 100) {
    // Fetch the article data (Rank ID, Title, Timestamp) of the articles currently displayed
    const newArticlesData = await getArticleData(page);
    
    // Append new articles and sort by timestamp in descending order
    articlesData = articlesData.concat(newArticlesData);
    articlesData = articlesData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit to 100 articles to prevent unnecessary processing
    if (articlesData.length >= 100) {
      articlesData = articlesData.slice(0, 100);
    }

    // Load more articles if needed
    if (articlesData.length < 100) {
      await loadAdditionalArticles(page);
    }
  }

  // Check if the articles are sorted correctly by timestamp (newest to oldest)
  const isCorrectlySorted = articlesData.every((article, index, arr) => {
    return index === 0 || new Date(arr[index - 1].timestamp) >= new Date(article.timestamp);
  });

  // Display the first 100 articles with Rank ID, Title, and Timestamp
  console.log('First 100 articles:', articlesData);

  console.log(
    isCorrectlySorted
      ? 'The first 100 articles are sorted from newest to oldest.'
      : 'The first 100 articles are NOT sorted correctly.'
  );

  // Optionally close the browser (uncomment when done)
  // await browser.close();
}

(async () => {
  await collectAndValidateArticles();
})();
