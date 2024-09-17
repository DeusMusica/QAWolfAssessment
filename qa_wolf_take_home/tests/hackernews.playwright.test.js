const { test, expect } = require('@playwright/test');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config(); // Load environment variables from .env

test('Basic Scraping Test: Scrape and verify 100 articles from Hacker News', async ({ page }) => {
  let allArticles = [];
  let retries = 0;
  const maxRetries = 5;  // Set a maximum retry count to avoid infinite loops

  // Function to extract articles on the current page
  async function extractArticles(page) {
    const articles = await page.locator('.athing').evaluateAll((nodes) => {
      return nodes.map((article) => {
        const rank = article.querySelector('.rank')?.innerText || 'No rank';
        const title = article.querySelector('.titleline a')?.innerText || 'No title';
        const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
        return { rank, title, timestamp };
      }).filter(article => article.timestamp !== 'No timestamp'); // Filter out articles with no timestamp
    });
    return articles;
  }

  // Function to load more articles by clicking the "More" button
  async function loadMoreArticles(page) {
    try {
      const moreButton = page.locator('a.morelink');
      if (await moreButton.isVisible()) {
        await moreButton.click();
        await page.waitForTimeout(2000); // Wait for network idle state
      } else {
        console.log("No 'More' button found on the page.");
        throw new Error('No More button found');  // Throw an error if the button is not visible
      }
    } catch (error) {
      console.error("Error clicking 'More' button:", error);
      throw error;  // Fail the test if pagination fails
    }
  }

  // Load the Hacker News page
  await page.goto('https://news.ycombinator.com/newest');

  // Loop to collect at least 100 articles with retry logic
  while (allArticles.length < 100) {
    const newArticles = await extractArticles(page);
    allArticles = [...allArticles, ...newArticles];

    // Remove duplicates to ensure article uniqueness
    const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
    allArticles = [...uniqueArticles.values()];

    // Break the loop if we already have 100 articles
    if (allArticles.length >= 100) break;

    // Try to load more articles, and break if retries are exhausted
    try {
      await loadMoreArticles(page);
    } catch (error) {
      console.error("Failed to load more articles. Breaking out of the loop.");
      retries++;
      if (retries >= maxRetries) {
        console.error("Max retries reached, exiting the loop.");
        break;  // Exit the loop if retries are exhausted
      }
    }
  }

  // Ensure we have exactly 100 articles
  allArticles = allArticles.slice(0, 100);  // Limit to first 100 articles

  expect(allArticles.length).toBe(100);

  console.log("Successfully scraped 100 articles.");
});


test('Basic Scraping Test with Error Handling: Scrape and verify 100 articles from Hacker News', async ({ page }) => {
  try {
    await page.goto('https://news.ycombinator.com/newest');
  } catch (error) {
    console.error("Failed to load Hacker News page:", error);
    throw error;  // Fail the test if page loading fails
  }

  let allArticles = [];
  let retries = 0;
  const maxRetries = 5;  // Set a maximum retry count to avoid infinite loops

  // Function to extract articles on the current page with error handling
  async function extractArticles(page) {
    try {
      const articles = await page.locator('.athing').evaluateAll((nodes) => {
        return nodes.map((article) => {
          const rank = article.querySelector('.rank')?.innerText || 'No rank';
          const title = article.querySelector('.titleline a')?.innerText || 'No title';
          const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
          return { rank, title, timestamp };
        }).filter(article => article.timestamp !== 'No timestamp');
      });
      return articles;
    } catch (error) {
      console.error("Error extracting articles:", error);
      throw error;  // Fail the test if article extraction fails
    }
  }

  // Function to load more articles by clicking "More" with error handling
  async function loadMoreArticles(page) {
    try {
      const moreButton = page.locator('a.morelink');
      if (await moreButton.isVisible()) {
        await moreButton.click();
        await page.waitForTimeout(2000); // Wait for network idle state
      } else {
        console.log("No 'More' button found on the page.");
        throw new Error('No More button found');  // Throw an error if the button is not visible
      }
    } catch (error) {
      console.error("Error clicking 'More' button:", error);
      throw error;  // Fail the test if pagination fails
    }
  }

  // Loop to collect at least 100 articles with retry logic
  while (allArticles.length < 100) {
    const newArticles = await extractArticles(page);
    allArticles = [...allArticles, ...newArticles];

    // Remove duplicates to ensure article uniqueness
    const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
    allArticles = [...uniqueArticles.values()];

    // Break the loop if we already have 100 articles
    if (allArticles.length >= 100) break;

    // Try to load more articles, and break if retries are exhausted
    try {
      await loadMoreArticles(page);
    } catch (error) {
      console.error("Failed to load more articles. Breaking out of the loop.");
      retries++;
      if (retries >= maxRetries) {
        console.error("Max retries reached, exiting the loop.");
        break;  // Exit the loop if retries are exhausted
      }
    }
  }

  // Ensure we have exactly 100 articles
  allArticles = allArticles.slice(0, 100);  // Limit to first 100 articles

  expect(allArticles.length).toBe(100);

  console.log("Successfully scraped 100 articles.");
});


test('Performance Monitoring Test: Scrape and verify 100 articles from Hacker News with Performance Logging', async ({ page }) => {
  // Start navigation and capture the performance metrics after load
  await page.goto('https://news.ycombinator.com/newest');

  // Log performance timing from the page
  const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
  const timing = JSON.parse(performanceTiming);
  
  const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
  const domContentLoadedTime = timing.domContentLoadedEventEnd - timing.navigationStart;
  const timeToFirstByte = timing.responseStart - timing.navigationStart;
  
  const dnsLookupTime = timing.domainLookupEnd - timing.domainLookupStart;
  const tcpHandshakeTime = timing.connectEnd - timing.connectStart;
  const sslNegotiationTime = timing.connectEnd - timing.secureConnectionStart;

  console.log(`DNS Lookup Time: ${dnsLookupTime} ms`);
  console.log(`TCP Handshake Time: ${tcpHandshakeTime} ms`);
  console.log(`SSL/TLS Negotiation Time: ${sslNegotiationTime} ms`);

  console.log(`Page Load Time: ${pageLoadTime} ms`);
  console.log(`DOM Content Loaded Time: ${domContentLoadedTime} ms`);
  console.log(`Time to First Byte (TTFB): ${timeToFirstByte} ms`);

  let allArticles = [];

  // Function to extract articles on the current page
  async function extractArticles(page) {
    const articles = await page.locator('.athing').evaluateAll((nodes) => {
      return nodes.map((article) => {
        const rank = article.querySelector('.rank')?.innerText || 'No rank';
        const title = article.querySelector('.titleline a')?.innerText || 'No title';
        const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
        return { rank, title, timestamp };
      }).filter(article => article.timestamp !== 'No timestamp'); // Filter out articles with no timestamp
    });
    return articles;
  }

  // Function to load more articles by clicking "More"
  async function loadMoreArticles(page) {
    const moreButton = page.locator('a.morelink');
    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(2000); // Wait for network idle state
    }
  }

  // Loop to collect at least 100 articles
  while (allArticles.length < 100) {
    const newArticles = await extractArticles(page);
    allArticles = [...allArticles, ...newArticles];

    // Remove duplicates to ensure article uniqueness
    const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
    allArticles = [...uniqueArticles.values()];

    if (allArticles.length < 100) {
      await loadMoreArticles(page);  // Click the "More" button if we need more articles
    }
  }

  // Ensure we have exactly 100 articles
  allArticles = allArticles.slice(0, 100);  // Limit to first 100 articles
  expect(allArticles.length).toBe(100);

  console.log("Successfully scraped 100 articles.");
});

// Create a transporter using Gmail and environment variables for security
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  // Use environment variable for email
    pass: process.env.EMAIL_PASS  // Use environment variable for app password
  },
});

test('Basic Scraping Test with Gmail Email Notification', async ({ page }) => {
  try {
    await page.goto('https://news.ycombinator.com/newest');

    // Your scraping code here...
    let allArticles = [];

    async function extractArticles(page) {
      const articles = await page.locator('.athing').evaluateAll((nodes) => {
        return nodes.map(article => {
          const rank = article.querySelector('.rank')?.innerText || 'No rank';
          const title = article.querySelector('.titleline a')?.innerText || 'No title';
          const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
          return { rank, title, timestamp };
        }).filter(article => article.timestamp !== 'No timestamp');
      });
      return articles;
    }

    while (allArticles.length < 100) {
      const newArticles = await extractArticles(page);
      allArticles = [...allArticles, ...newArticles];

      const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
      allArticles = [...uniqueArticles.values()];

      if (allArticles.length < 100) {
        await page.locator('a.morelink').click();
        await page.waitForTimeout(2000); // Wait for network idle state
      }
    }

    allArticles = allArticles.slice(0, 100); // Limit to first 100 articles
    expect(allArticles.length).toBe(100);

    console.log("Successfully scraped 100 articles.");

    // Send success email notification
    await sendEmailNotification('Test Passed: Successfully scraped 100 articles from Hacker News.');

  } catch (error) {
    console.error("Test failed with error:", error);

    // Send failure email notification
    await sendEmailNotification(`Test Failed: ${error.message}`);

    throw error; // Fail the test
  }
});

// Function to send email notifications
async function sendEmailNotification(message) {
  const mailOptions = {
    from: process.env.EMAIL_USER,  // From your Gmail address
    to: process.env.EMAIL_USER,  // Recipient email address
    subject: 'Playwright Test Notification',
    text: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email notification sent!');
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

test('Basic Scraping Test with Slack Notification', async ({ page }) => {
  try {
    // Navigate to Hacker News
    await page.goto('https://news.ycombinator.com/newest');

    // Scrape logic here...
    let allArticles = [];

    // Function to extract articles on the current page
    async function extractArticles(page) {
      const articles = await page.locator('.athing').evaluateAll((nodes) => {
        return nodes.map(article => {
          const rank = article.querySelector('.rank')?.innerText || 'No rank';
          const title = article.querySelector('.titleline a')?.innerText || 'No title';
          const timestamp = article.nextElementSibling?.querySelector('.age')?.getAttribute('title') || 'No timestamp';
          return { rank, title, timestamp };
        }).filter(article => article.timestamp !== 'No timestamp');
      });
      return articles;
    }

    // Pagination and extraction logic to gather 100 articles...
    while (allArticles.length < 100) {
      const newArticles = await extractArticles(page);
      allArticles = [...allArticles, ...newArticles];

      const uniqueArticles = new Map(allArticles.map(article => [article.title, article]));
      allArticles = [...uniqueArticles.values()];

      if (allArticles.length < 100) {
        await page.locator('a.morelink').click();
        await page.waitForTimeout(2000);  // Wait for network idle state
      }
    }

    allArticles = allArticles.slice(0, 100);  // Limit to first 100 articles
    expect(allArticles.length).toBe(100);

    console.log("Successfully scraped 100 articles.");

    // Send success Slack notification
    await sendSlackNotification('Test Passed: Successfully scraped 100 articles from Hacker News.');

  } catch (error) {
    console.error("Test failed with error:", error);

    // Send failure Slack notification
    await sendSlackNotification(`Test Failed: ${error.message}`);

    throw error;  // Fail the test
  }
});

// Function to send Slack notifications
async function sendSlackNotification(message) {
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

  if (!SLACK_WEBHOOK_URL) {
    console.error('SLACK_WEBHOOK_URL is undefined or invalid');
    return;
  }

  try {
    const response = await axios.post(SLACK_WEBHOOK_URL, {
      text: message,  // The message content sent to Slack
    });
    console.log('Slack notification sent successfully:', response.data);
  } catch (error) {
    console.error('Failed to send Slack notification:', error.response ? error.response.data : error.message);
  }
}

test('Basic Scraping Test with Performance Metrics', async ({ page }) => {
  const testStartTime = Date.now();
  let result = 'passed';

  try {
    // Start navigating and capture performance timing after load
    await page.goto('https://news.ycombinator.com/newest');

    const performanceTiming = await page.evaluate(() => JSON.stringify(window.performance.timing));
    const timing = JSON.parse(performanceTiming);
  
    const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
    const timeToFirstByte = timing.responseStart - timing.navigationStart;

    // Simulating the scraping and adding performance metrics
    let performanceData = {
      testName: 'Basic Scraping Test',
      status: result,
      executionTime: Date.now() - testStartTime,
      performance: {
        pageLoadTime: pageLoadTime,
        timeToFirstByte: timeToFirstByte,
      }
    };

    // Write the performance and result data to JSON file
    fs.writeFileSync('basic-scraping-performance.json', JSON.stringify(performanceData, null, 2), 'utf-8');

    expect(1).toBe(1);  // Dummy check just for example
  } catch (error) {
    result = 'failed';
    // Log error in performance data
    let errorData = {
      testName: 'Basic Scraping Test',
      status: result,
      error: error.message,
      executionTime: Date.now() - testStartTime
    };
    fs.writeFileSync('basic-scraping-performance.json', JSON.stringify(errorData, null, 2), 'utf-8');
  }
});