
# Project Documentation

## Table of Contents
- [Introduction](#introduction)
- [Setup Guide](#setup-guide)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Project Installation](#2-project-installation)
  - [3. Setting up Environment Variables (Optional)](#3-setting-up-environment-variables-optional)
    - [3.1 How to Get an App Password for Gmail](#31-how-to-get-an-app-password-for-gmail)
    - [3.2 How to Set up a Slack Webhook](#32-how-to-set-up-a-slack-webhook)
  - [4. Running the Project](#4-running-the-project)
    - [Option 1: Running Files Individually](#option-1-running-files-individually)
    - [Option 2: Using runner.js for Automation](#option-2-using-runnerjs-for-automation)
  - [5. Running Individual Tests](#5-running-individual-tests)
  - [6. Handling CAPTCHA Test Timeout](#6-handling-captcha-test-timeout)
- [Technical Overview](#technical-overview)
  - [1. Scraping Hacker News Articles](#1-scraping-hacker-news-articles)
  - [2. Automated Tests](#2-automated-tests)
  - [3. Notifications](#3-notifications)
  - [4. Dashboard](#4-dashboard)
  - [5. Trace Files](#5-trace-files)
- [Conclusion](#conclusion)

## Introduction
This project is designed to scrape articles from Hacker News, run various automated tests using Playwright, capture performance metrics, and send notifications via email and Slack. It provides flexibility in running tests either individually or by using a single runner script. The project also includes a dashboard for viewing test results, performance data, and downloading trace files.

## Setup Guide

### 1. Prerequisites
Before you can set up and run the project, ensure that the following are installed on your machine:
- **Node.js** (v14 or higher)
- **npm** (Node Package Manager)
- **Playwright** (installed as part of the project)
  
To verify if Node.js and npm are installed, you can run the following commands:
```bash
node -v
npm -v
```

### 2. Project Installation
Once the prerequisites are set up, follow these steps to install the project dependencies:

Clone the repository:
```bash
git clone <repository-url>
```

Navigate to the project directory:
```bash
cd <project-directory>
```

Install all required npm packages:
```bash
npm install
```

### 3. Setting up Environment Variables (Optional)
This project includes a flag to enable or disable notifications, which allows it to be run without setting up environment variables. To run the project without notifications, simply skip setting up the .env file. Notifications will be disabled by default unless you explicitly enable them.

If you choose to enable notifications (email and Slack), follow these steps to create the .env file:

In the root of your project directory, create a new file called .env.
Add the following environment variables to the file:
```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/slack/webhook/url
SEND_NOTIFICATIONS=true
```
If the .env file or the SEND_NOTIFICATIONS variable is missing, notifications will be automatically disabled.

#### 3.1 How to Get an App Password for Gmail
Follow these steps to generate an app password for Gmail:

- Visit [Google App Passwords](https://myaccount.google.com/apppasswords).
- Under "Select the app", choose "Mail" and select "Other (Custom name)".
- Name it something like "Playwright Test Notifications".
- Click Generate and copy the password. This will be your EMAIL_PASS.

#### 3.2 How to Set up a Slack Webhook
- Go to your Slack workspace and navigate to **Settings & administration > Manage apps**.
- Search for **Incoming Webhooks** and install the app.
- Create a new webhook for your channel.
- Copy the URL provided and add it to your .env file as `SLACK_WEBHOOK_URL`.

### 4. Running the Project

#### Option 1: Running Files Individually
Run the scraper to collect articles:
```bash
node index.js
```
This will scrape 100 articles from Hacker News and store them in `scraped-articles.json`.

Run Playwright tests:
```bash
npx playwright test
```
This will run all the tests, including performance monitoring, link validation, login validation with CAPTCHA, and API tests. The results, including performance metrics like page load time and time to first byte, will be stored in `testResults.json`.

Start the HTTP server to view the dashboard:
```bash
npx http-server -p 8080
```
Open the browser and navigate to [http://localhost:8080](http://localhost:8080) to view the dashboard.

#### Option 2: Using runner.js for Automation
We made updates to automate the process of opening the browser to display the dashboard after the HTTP server starts, and now the browser will directly open the `dashboard.html` page, avoiding the default directory listing:

Run the automation via:
```bash
node runner.js
```
This will:
- Scrape 100 articles from Hacker News using `index.js`.
- Run all Playwright tests, updating `testResults.json`.
- Automatically open the dashboard in a Chrome browser to display test results and performance metrics.

### 5. Running Individual Tests
You can also run specific tests directly using Playwright:
```bash
npx playwright test <test-file> --project=<browser>
```

### 6. Handling CAPTCHA Test Timeout
One of the tests simulates login validation with a mocked CAPTCHA. If CAPTCHA persists, you may need to increase the test timeout:
```js
test.setTimeout(60000); // 60 seconds timeout
```

## Technical Overview

### 1. Scraping Hacker News Articles
The script (`index.js`) uses Playwright to scrape articles from Hacker News. It gathers the article’s rank, title, and timestamp, then writes the first 100 articles to a `scraped-articles.json` file.

### 2. Automated Tests
We’ve made several updates to the test files based on feedback and changes:

- **Basic Scraping Test**: This test now uses more Playwright-centric methods, avoiding vanilla JS where possible, ensuring consistency with our best practices.
- **Link Click Validation**: Repeating assertions are now used for elements like the first article link. This ensures the test is resilient, waiting for the article link to be visible.
- **Login Validation with Mocked CAPTCHA**: Added repeating assertions to prevent instant failures, and more flexible timeouts have been introduced to handle potential delays. This includes waiting for elements like the username and password fields to appear and validate after filling in the form.
- **Hacker News API Validation**: We’ve improved the comparison between article titles from the Hacker News API and the web UI by using more accurate matching techniques. We now compare the normalized API titles with the page titles and assert that they are visible using Playwright’s built-in methods, ensuring accurate validation of the content.

### 3. Notifications
Notifications can be sent via email and Slack depending on the `SEND_NOTIFICATIONS` flag. If the flag is set to true and environment variables are provided, notifications will be sent via:
- **Email** using Gmail SMTP.
- **Slack** via the webhook URL provided.

### 4. Dashboard
The dashboard (`dashboard.html`) displays scraped articles, test results, and two charts for performance metrics, including page load time and time to first byte captured during the **Basic Scraping Test** and **Performance Monitoring test**.

Additionally, the dashboard now automatically opens in a browser via `runner.js` after the HTTP server starts, displaying the scraped articles, test results, and trace file download links.

### 5. Trace Files
Trace files are generated during the **Performance Monitoring test**. They can be opened using:
```bash
npx playwright show-trace <trace-file-path>
```
Only one trace file can be open at a time.

## Conclusion
This project provides a robust framework for testing web pages, scraping data, and generating performance metrics. It can be run either step-by-step or automated via `runner.js`, with results presented in a user-friendly dashboard. The recent changes ensure tests are more robust and aligned with best practices for handling asynchronous operations and test validation.
