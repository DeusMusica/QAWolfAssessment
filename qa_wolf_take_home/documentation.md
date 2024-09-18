
# QA Wolf Assessment Documentation

## Overview

This project automates the process of scraping articles from Hacker News using Playwright. It collects the latest 100 articles, gathers performance metrics, and stores both the article data and test results in JSON files. A custom dashboard is provided to visualize the results and performance data. Notifications about the test results are sent via email and Slack.

---

## Table of Contents

1. [Structure Overview](#structure-overview)
2. [Core Components](#core-components)
   1. [Playwright Test File](#playwright-test-file)
   2. [Custom Dashboard](#custom-dashboard)
   3. [Runner Script](#runner-script)
   4. [Global Teardown](#global-teardown)
   5. [Scraper Script](#scraper-script)
3. [Use Cases](#use-cases)
4. [Scalability Considerations](#scalability-considerations)
5. [Possible Improvements](#possible-improvements)

---

## Structure Overview

This project consists of several core scripts that work together to scrape articles, run tests, display results on a dashboard, and notify the team of test outcomes.

- **Playwright Test File**: Defines the web scraping logic and performance testing using Playwright.
- **Custom Dashboard**: A dashboard to display scraped articles and test results.
- **Runner Script**: Automates the process of running tests, storing results, and launching the dashboard.
- **Global Teardown**: Handles email and Slack notifications after tests are complete.
- **Scraper Script**: A standalone script to scrape the latest 100 articles from Hacker News and store them in a JSON file.

---

## Core Components

### Playwright Test File

This file handles the core web scraping and test automation using Playwright. It contains helper functions to extract article data, load more articles, and verify the correct number of articles scraped.

\```javascript
import { test, expect } from '@playwright/test';
import fs from 'fs';

// Function to scrape 100 articles from Hacker News
async function scrapeAndVerifyArticles(page) { /* ... */ }

// Basic scraping test
test('Basic Scraping Test: Scrape and verify 100 articles', async ({ page }, testInfo) => { /* ... */ });

// After each test, store results in a JSON file
test.afterEach(async ({}, testInfo) => { /* ... */ });
\```

- **Tests**: There are multiple tests to ensure 100 articles are scraped correctly and performance metrics are gathered.
- **Performance Monitoring**: Logs key metrics like page load time and time to first byte.
- **Data Storage**: Test results, including the number of articles and performance data, are saved to a JSON file.

### Custom Dashboard

This HTML-based dashboard displays the scraped articles and test results. It includes a performance monitoring chart to visualize key performance metrics using Chart.js.

\```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scraped Articles and Test Results Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h1>Scraped Articles and Test Results Dashboard</h1>
  <ul id="articleList"></ul>
  <ul id="testResultsList"></ul>
  <canvas id="performanceChart"></canvas>
  <script> /* JavaScript to fetch and display data */ </script>
</body>
</html>
\```

- **Display**: Shows a list of scraped articles and test results.
- **Performance Chart**: Visualizes the page load time and time to first byte using a bar chart.
- **Data Source**: Fetches data from `scraped-articles.json` and `testResults.json`.

### Runner Script

This script automates the process of running the Playwright tests, saving the results, and launching the dashboard.

\```javascript
import { exec } from 'child_process';
import open from 'open';
import fs from 'fs';

// Function to run tests and output results
async function runTests() { /* ... */ }

// Function to start the local dashboard server
async function startDashboard() { /* ... */ }

// Main function to run tests and open the dashboard
async function main() {
  await runTests();
  await startDashboard();
}
main();
\```

- **Automated Test Execution**: Runs the Playwright tests and outputs progress.
- **Local Server**: Starts an HTTP server to serve the dashboard and opens it in the default browser.

### Global Teardown

This script reads the test results from the `testResults.json` file and sends notifications via email and Slack using `nodemailer` and `axios`.

\```javascript
import nodemailer from 'nodemailer';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Send test results via email
async function sendEmailNotification(summary) { /* ... */ }

// Send test results via Slack
async function sendSlackNotification(summary) { /* ... */ }

// Global teardown to send notifications
async function globalTeardown() { /* ... */ }
export default globalTeardown;
\```

- **Email Notifications**: Sends the test results summary via email using the Gmail service.
- **Slack Notifications**: Sends the test results summary to a configured Slack channel.
- **Grouped Results**: Test results are grouped by test name in the summary.

### Scraper Script

This standalone script uses Playwright to scrape the latest 100 articles from Hacker News, processes the relative timestamps, and saves the data to a JSON file.

\```javascript
import { chromium } from 'playwright';
import fs from 'fs';

// Function to extract article data and handle pagination
async function collectAndValidateArticles() { /* ... */ }

// Run the script
(async () => {
  await collectAndValidateArticles();
})();
\```

- **Pagination Handling**: Automatically clicks the "More" button to load additional articles.
- **Timestamp Conversion**: Converts relative times (e.g., '5 hours ago') to absolute elapsed times.
- **JSON Output**: Saves the scraped article data in `scraped-articles.json`.

---

## Use Cases

- **Web Scraping for Data Analysis**: This project automates the scraping of news articles and stores them for analysis. It’s particularly useful for keeping track of trending articles on Hacker News.
  
- **Test Automation with Performance Monitoring**: The Playwright tests not only scrape data but also log performance metrics, helping you monitor how well web pages load and perform over time.

- **Custom Dashboard for Monitoring**: The dashboard provides an easy way to view scraped data and test results, with a performance chart for key metrics.

- **Automated Notifications**: Email and Slack notifications ensure that test results and performance data are distributed to the relevant team members automatically.

---

## Scalability Considerations

- **Increased Scraping Capacity**: You can easily modify the scraper to collect more than 100 articles or to scrape from multiple sources by adjusting the logic in `collectAndValidateArticles`.

- **Parallel Execution**: The tests can be expanded to run in parallel across multiple browsers and environments using Playwright’s parallel test execution features.

- **Data Storage**: As the number of articles and test results grows, consider switching from JSON file storage to a more scalable solution like a database (e.g., MongoDB).

- **Advanced Performance Monitoring**: Additional metrics such as network request counts or memory usage could be tracked and visualized on the dashboard.

---

## Possible Improvements

1. **Improved Error Handling**: Enhance error handling across the scraping and test automation scripts, particularly in cases where pages fail to load or elements are missing.
   
2. **Pagination Enhancements**: For larger-scale scraping, introduce more sophisticated pagination techniques to handle infinite scrolling or dynamically loaded content.

3. **Expanded Metrics Tracking**: Add more detailed performance metrics, such as CPU usage or memory consumption, to better understand the resource impact of the scraping process.

4. **Database Integration**: For larger-scale scraping projects, consider integrating a database to store articles and test results instead of relying on JSON files.

5. **Dynamic Dashboard Updates**: Implement live data updates on the dashboard, so new articles or test results are displayed without requiring a page refresh.

---

This documentation provides a detailed explanation of how the project components work together and includes considerations for future scalability and improvements. Each part of the system has been designed with extensibility and automation in mind, making it easy to adapt for larger-scale scraping and testing operations.
