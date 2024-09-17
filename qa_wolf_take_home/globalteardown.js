import fs from 'fs';
import nodemailer from 'nodemailer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

// ------------------ Notification Functions ------------------

/**
 * Sends an email notification with the test results summary.
 * @param {string} summary - The test results summary to send via email.
 */
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
    console.error('Error sending email notification:', error);
  }
}

/**
 * Sends a Slack notification with the test results summary.
 * @param {string} summary - The test results summary to send via Slack.
 */
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

// ------------------ Global Teardown ------------------

/**
 * Reads the test results and sends notifications via email and Slack.
 */
async function globalTeardown() {
  try {
    // Read test results from JSON file
    const data = fs.readFileSync('testResults.json', 'utf-8');
    const testResults = JSON.parse(data);

    // Group test results by test name
    const groupedResults = {};

    testResults.forEach(result => {
      if (!groupedResults[result.test]) {
        groupedResults[result.test] = [];
      }
      groupedResults[result.test].push(result);
    });

    // Generate summary grouped by test name
    let summary = 'Test Results Summary by Test:\n\n';

    Object.keys(groupedResults).forEach(testName => {
      summary += `Test: ${testName}\n`;
      groupedResults[testName].forEach(result => {
        summary += `  Browser: ${result.browser}\n`;
        summary += `  Status: ${result.status}\n`;
        summary += `  Articles: ${result.articles}\n`;
        if (result.performance) {
          summary += `  Page Load Time: ${result.performance.pageLoadTime || 'undefined'} ms\n`;
          summary += `  Time to First Byte (TTFB): ${result.performance.timeToFirstByte || 'undefined'} ms\n`;
        }
        summary += '\n';
      });
    });

    // Send email and Slack notifications
    await sendEmailNotification(summary);
    await sendSlackNotification(summary);

  } catch (error) {
    console.error('Error reading test results file:', error);
  }
}

export default globalTeardown;
