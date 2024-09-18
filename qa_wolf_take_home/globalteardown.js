import fs from 'fs';
import nodemailer from 'nodemailer';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from the .env file, if it exists
dotenv.config();

// Optional: Set SEND_NOTIFICATIONS in the code
const SEND_NOTIFICATIONS = process.env.SEND_NOTIFICATIONS === 'true' || false; // Default is false

// ------------------ Notification Functions ------------------

async function sendEmailNotification(summary) {
  if (!SEND_NOTIFICATIONS) {
    console.log('Email notifications are disabled.');
    return;
  }

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.error('Email credentials are missing.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser, // Use environment variable for email
      pass: emailPass, // Use environment variable for app password
    },
  });

  const mailOptions = {
    from: emailUser, // Sender's email address
    to: emailUser, // Recipient's email address
    subject: 'Playwright Test Results Summary',
    text: summary,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email notification sent successfully!');
  } catch (error) {
    console.error('Error sending email notification:', error.message);
  }
}

async function sendSlackNotification(summary) {
  if (!SEND_NOTIFICATIONS) {
    console.log('Slack notifications are disabled.');
    return;
  }

  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

  if (!SLACK_WEBHOOK_URL) {
    console.error('Slack webhook URL is missing.');
    return;
  }

  try {
    await axios.post(SLACK_WEBHOOK_URL, { text: summary });
    console.log('Slack notification sent successfully!');
  } catch (error) {
    console.error('Error sending Slack notification:', error.message);
  }
}

// ------------------ Helper Functions ------------------

/**
 * Group test results by test name.
 */
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

/**
 * Generate summary report for the test results.
 */
function generateSummary(groupedResults) {
  let summary = 'Test Results Summary by Test:\n\n';

  Object.keys(groupedResults).forEach(testName => {
    summary += `Test: ${testName}\n`;
    groupedResults[testName].forEach(result => {
      summary += `  Browser: ${result.browser}\n`;
      summary += `  Status: ${result.status}\n`;

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

    // Generate summary
    const summary = generateSummary(groupedResults);

    // Only send notifications if the SEND_NOTIFICATIONS flag is true
    if (SEND_NOTIFICATIONS) {
      await Promise.all([sendEmailNotification(summary), sendSlackNotification(summary)]);
    } else {
      console.log('Notifications are disabled.');
    }
  } catch (error) {
    console.error('Error reading test results file:', error.message);
  }
}

export default globalTeardown;
