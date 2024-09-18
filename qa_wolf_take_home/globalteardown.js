import fs from 'fs';
import nodemailer from 'nodemailer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

// ------------------ Notification Functions ------------------

async function sendEmailNotification(summary) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,  // Use environment variable for email
      pass: process.env.EMAIL_PASS,  // Use environment variable for app password
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,  // Sender's email address
    to: process.env.EMAIL_USER,    // Recipient's email address
    subject: 'Playwright Test Results Summary',
    text: summary,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email notification sent successfully!');
  } catch (error) {
    console.error('Error sending email notification:', error.message);
    console.error('Ensure EMAIL_USER and EMAIL_PASS are correctly set in your environment variables.');
  }
}

async function sendSlackNotification(summary) {
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

  if (!SLACK_WEBHOOK_URL) {
    console.error('SLACK_WEBHOOK_URL is undefined or invalid');
    return;
  }

  try {
    await axios.post(SLACK_WEBHOOK_URL, {
      text: summary,  // Message content for Slack
    });
    console.log('Slack notification sent successfully!');
  } catch (error) {
    console.error('Error sending Slack notification:', error.response ? error.response.data : error.message);
  }
}

// ------------------ Helper Functions ------------------

/**
 * Convert articles array to a readable string format for notifications.
 */
function formatArticles(articles) {
  return `Total Articles Scraped: ${articles.length}`;
}

function groupTestResults(testResults) {
  const groupedResults = {};

  testResults.forEach(result => {
    if (!groupedResults[result.test]) {
      groupedResults[result.test] = [];
    }
    groupedResults[result.test].push(result);
  });

  return groupedResults;
}

function generateSummary(groupedResults) {
  let summary = 'Test Results Summary by Test:\n\n';

  Object.keys(groupedResults).forEach(testName => {
    summary += `Test: ${testName}\n`;
    groupedResults[testName].forEach(result => {
      summary += `  Browser: ${result.browser}\n`;
      summary += `  Status: ${result.status}\n`;

      // Display article count if articles were scraped
      if (result.articles && result.articles.length > 0) {
        summary += `  Articles: ${result.articles.length}\n`;
      } else {
        summary += '  Articles: N/A\n';
      }

      if (result.performance) {
        const pageLoadTime = result.performance.pageLoadTime !== undefined ? result.performance.pageLoadTime : 'N/A';
        const timeToFirstByte = result.performance.timeToFirstByte !== undefined ? result.performance.timeToFirstByte : 'N/A';
        summary += `  Page Load Time: ${pageLoadTime} ms\n`;
        summary += `  Time to First Byte (TTFB): ${timeToFirstByte} ms\n`;
      } else {
        summary += '  Page Load Time: N/A\n';
        summary += '  Time to First Byte (TTFB): N/A\n';
      }

      summary += '\n';
    });
  });

  return summary;
}

// ------------------ Global Teardown ------------------

async function globalTeardown() {
  try {
    // Read test results from JSON file
    const data = fs.readFileSync('testResults.json', 'utf-8');
    const testResults = JSON.parse(data);

    // Group test results by test name
    const groupedResults = groupTestResults(testResults);

    // Generate summary grouped by test name
    const summary = generateSummary(groupedResults);

    // Send email and Slack notifications concurrently
    await Promise.all([
      sendEmailNotification(summary),
      sendSlackNotification(summary)
    ]);

  } catch (error) {
    console.error('Error reading test results file:', error.message);
  }
}

export default globalTeardown;
