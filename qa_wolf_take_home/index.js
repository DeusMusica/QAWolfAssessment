import { chromium } from 'playwright';  // Use import instead of require
import fs from 'fs';  // Use import for fs

async function loadAdditionalArticles(page) {
  const moreButton = await page.$('a.morelink');
  if (moreButton) {
    await moreButton.click();
    await page.waitForSelector('a.morelink', { state: 'attached' });
  }
}

async function getArticleData(page) {
  return await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('.athing'));
    return articles.map(article => {
      const id = article.getAttribute('id');  // Get the article ID
      const rank = article.querySelector('.rank')?.innerText || 'No rank'; 
      const titleElement = article.querySelector('.titleline a');
      const title = titleElement ? titleElement.innerText : 'No title';
      const timeElement = article.nextElementSibling?.querySelector('.age');
      const timestamp = timeElement ? timeElement.innerText : 'No timestamp'; 

      return { id, rank, title, timestamp };
    }).filter(article => article.timestamp !== 'No timestamp');
  });
}

function calculateElapsedTime(relativeTime) {
  const currentTime = new Date();
  const timeParts = relativeTime.split(' ');

  let elapsedTime = currentTime;

  if (timeParts.includes('minute') || timeParts.includes('minutes')) {
    const minutesAgo = parseInt(timeParts[0]);
    elapsedTime = new Date(currentTime.getTime() - minutesAgo * 60000); 
  } else if (timeParts.includes('hour') || timeParts.includes('hours')) {
    const hoursAgo = parseInt(timeParts[0]);
    elapsedTime = new Date(currentTime.getTime() - hoursAgo * 3600000);
  } else if (timeParts.includes('day') || timeParts.includes('days')) {
    const daysAgo = parseInt(timeParts[0]);
    elapsedTime = new Date(currentTime.getTime() - daysAgo * 86400000);
  } else if (relativeTime === 'yesterday') {
    elapsedTime = new Date(currentTime.getTime() - 24 * 3600000); 
  }

  const diffMs = currentTime - elapsedTime;
  const diffHrs = Math.floor(diffMs / 3600000); 
  const diffDays = Math.floor(diffHrs / 24);

  if (diffDays >= 1) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else {
    return `${diffHrs} hour${diffHrs > 1 ? 's' : ''}`;
  }
}

async function collectAndValidateArticles() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://news.ycombinator.com/newest');

  let articlesData = [];

  while (articlesData.length < 100) {
    const newArticlesData = await getArticleData(page);
    articlesData = articlesData.concat(newArticlesData);
    articlesData = articlesData.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    if (articlesData.length >= 100) {
      articlesData = articlesData.slice(0, 100);
    }

    if (articlesData.length < 100) {
      await loadAdditionalArticles(page);
    }
  }

  articlesData = articlesData.map(article => ({
    ...article,
    elapsedTime: calculateElapsedTime(article.timestamp)
  }));

  fs.writeFileSync('scraped-articles.json', JSON.stringify(articlesData, null, 2), 'utf-8');  // Write the data to a JSON file

  console.log('First 100 articles:', articlesData);
  await browser.close();
}

(async () => {
  await collectAndValidateArticles();
})();
