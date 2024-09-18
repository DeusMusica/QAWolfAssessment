
# Project Documentation

## Table of Contents
- [Introduction](#introduction)
- [Setup Guide](#setup-guide)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Project Installation](#2-project-installation)
  - [3. Setting up Environment Variables](#3-setting-up-environment-variables)
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
1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```bash
   cd <project-directory>
   ```
3. Install all required npm packages:
   ```bash
   npm install
   ```

### 3. Setting up Environment Variables
This project requires a `.env` file to securely store sensitive credentials such as your Gmail credentials and Slack Webhook URL. Here’s how to create the `.env` file:

1. In the root of your project directory, create a new file called `.env`.
2. Add the following environment variables to the file:
   ```bash
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/slack/webhook/url
   ```

#### 3.1 How to Get an App Password for Gmail
Follow these steps to generate an app password for Gmail:
1. Visit [Google App Passwords](https://myaccount.google.com/apppasswords).
2. Under **Select the app**, choose "Mail" and select "Other (Custom name)".
3. Name it something like `Playwright Test Notifications`.
4. Click **Generate** and copy the password. This will be your `EMAIL_PASS`.

#### 3.2 How to Set up a Slack Webhook
1. Go to your Slack workspace and navigate to **Settings & administration** > **Manage apps**.
2. Search for **Incoming Webhooks** and install the app.
3. Create a new webhook for your channel.
4. Copy the URL provided and add it to your `.env` file as `SLACK_WEBHOOK_URL`.

### 4. Running the Project

#### Option 1: Running Files Individually
1. **Run the scraper to collect articles:**
   ```bash
   node index.js
   ```
   This will scrape 100 articles from Hacker News and store them in `scraped-articles.json`.

2. **Run Playwright tests:**
   ```bash
   npx playwright test
   ```
   This will run all the tests, including performance monitoring, link validation, and API tests. The results will be stored in `testResults.json`.

3. **Start the HTTP server to view the dashboard:**
   ```bash
   npx http-server -p 8080
   ```
   Open the browser and navigate to `http://localhost:8080` to view the dashboard.

#### Option 2: Using runner.js for Automation
Run the following command:
```bash
node runner.js
```

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
Playwright tests are included in `hackernews.playwright.test.js`, covering:
- **Basic Scraping Test**
- **Link Click Validation**
- **Login Validation with Mocked CAPTCHA**
- **Performance Monitoring**

### 3. Notifications
Once the tests are completed, the `globalTeardown.js` script sends notifications via:
- **Email** using Gmail SMTP.
- **Slack** via the webhook URL provided.

### 4. Dashboard
The dashboard (`dashboard.html`) displays scraped articles, test results, and two charts for performance metrics.

### 5. Trace Files
Trace files are generated during the **Performance Monitoring** test. They can be opened using:
```bash
npx playwright show-trace <trace-file-path>
```
Only one trace file can be open at a time.

## Conclusion
This project provides a robust framework for testing web pages, scraping data, and generating performance metrics. It can be run either step-by-step or automated via `runner.js`, with results presented in a user-friendly dashboard.
