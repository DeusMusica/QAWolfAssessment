import fs from 'fs';
import nodemailer from 'nodemailer';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from the .env file, if it exists
dotenv.config();

// Optional: Set SEND_NOTIFICATIONS based on environment variable or default to false
const SEND_NOTIFICATIONS = process.env.SEND_NOTIFICATIONS === 'true' || false; // Default to false if not specified

// ------------------ Notification Functions ------------------

/**
 * Send an email notification with the test summary.
 * Uses Gmail as the email service and credentials from environment variables.
 * If notifications are disabled or credentials are missing, the function will log the issue and return.
 * 
 * @param {string} summary - The test results summary to send via email.
 */
async function sendEmailNotification(summary) {
  // Check if email notifications are enabled
  if (!SEND_NOTIFICATIONS) {
    console.log('Email notifications are disabled.');
    return;
  }

  // Fetch email credentials from environment variables
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  // Log an error if email credentials are missing
  if (!emailUser || !emailPass) {
    console.error('Email credentials are missing.');
    return;
  }

  // Configure the email transporter using Gmail service and provided credentials
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser, // Email address from environment
      pass: emailPass, // App password from environment
    },
  });

  // Define the email options: recipient, subject, and body (summary)
  const mailOptions = {
    from: emailUser, // Sender's email
    to: emailUser, // Send the email to the same address (can be changed)
    subject: 'Playwright Test Results Summary',
    text: summary, // Summary of test results as the email body
  };

  try {
    // Attempt to send the email notification
    await transporter.sendMail(mailOptions);
    console.log('Email notification sent successfully!');
  } catch (error) {
    // Log any errors encountered while sending the email
    console.error('Error sending email notification:', error.message);
  }
}

/**
 * Send a Slack notification with the test summary.
 * Uses the Slack webhook URL from environment variables.
 * If notifications are disabled or the webhook URL is missing, the function will log the issue and return.
 * 
 * @param {string} summary - The test results summary to send via Slack.
 */
async function sendSlackNotification(summary) {
  // Check if Slack notifications are enabled
  if (!SEND_NOTIFICATIONS) {
    console.log('Slack notifications are disabled.');
    return;
  }

  // Fetch the Slack webhook URL from environment variables
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

  // Log an error if the Slack webhook URL is missing
  if (!SLACK_WEBHOOK_URL) {
    console.error('Slack webhook URL is missing.');
    return;
  }

  try {
    // Post the summary to the specified Slack webhook
    await axios.post(SLACK_WEBHOOK_URL, { text: summary });
    console.log('Slack notification sent successfully!');
  } catch (error) {
    // Log any errors encountered while sending the Slack notification
    console.error('Error sending Slack notification:', error.message);
  }
}

// ------------------ Helper Functions ------------------

/**
 * Group test results by test name.
 * Each test name will have an array of results (one per browser).
 * 
 * @param {Array} testResults - Array of test result objects.
 * @returns {Object} - An object with test names as keys and arrays of results as values.
 */
function groupTestResults(testResults) {
  const groupedResults = {};

  // Loop through all test results
  testResults.forEach(result => {
    // Initialize an array for each test name if it doesn't exist
    if (!groupedResults[result.test]) {
      groupedResults[result.test] = [];
    }
    // Push the current result into the corresponding test name's array
    groupedResults[result.test].push(result);
  });

  return groupedResults;
}

/**
 * Generate a summary report from the grouped test results.
 * The summary includes test names, browser, status, and performance metrics (if available).
 * 
 * @param {Object} groupedResults - Test results grouped by test name.
 * @returns {string} - A formatted summary of the test results.
 */
function generateSummary(groupedResults) {
  let summary = 'Test Results Summary by Test:\n\n';

  // Loop through each test name in the grouped results
  Object.keys(groupedResults).forEach(testName => {
    summary += `Test: ${testName}\n`; // Add test name to the summary

    // For each result within the test, add browser and status information
    groupedResults[testName].forEach(result => {
      summary += `  Browser: ${result.browser}\n`;
      summary += `  Status: ${result.status}\n`;

      // Include the number of articles if present, otherwise mark as N/A
      if (result.articles && result.articles.length > 0) {
        summary += `  Articles: ${result.articles.length}\n`;
      } else {
        summary += '  Articles: N/A\n';
      }

      // Include performance metrics if available, otherwise mark as N/A
      if (result.performance) {
        const pageLoadTime = result.performance.pageLoadTime !== undefined ? result.performance.pageLoadTime : 'N/A';
        const timeToFirstByte = result.performance.timeToFirstByte !== undefined ? result.performance.timeToFirstByte : 'N/A';
        summary += `  Page Load Time: ${pageLoadTime} ms\n`;
        summary += `  Time to First Byte (TTFB): ${timeToFirstByte} ms\n`;
      } else {
        summary += '  Page Load Time: N/A\n';
        summary += '  Time to First Byte (TTFB): N/A\n';
      }

      summary += '\n'; // Add a blank line between test results
    });
  });

  return summary; // Return the formatted summary string
}

// ------------------ Global Teardown ------------------

/**
 * Global teardown function executed after all tests.
 * This function reads the test results from a JSON file, generates a summary report,
 * and optionally sends email or Slack notifications based on environment settings.
 */
async function globalTeardown() {
  try {
    // Read test results from the JSON file
    const data = fs.readFileSync('testResults.json', 'utf-8');
    const testResults = JSON.parse(data); // Parse the JSON file contents

    // Group test results by test name
    const groupedResults = groupTestResults(testResults);

    // Generate a summary of the test results
    const summary = generateSummary(groupedResults);

    // If notifications are enabled, send email and Slack notifications
    if (SEND_NOTIFICATIONS) {
      await Promise.all([sendEmailNotification(summary), sendSlackNotification(summary)]);
    } else {
      console.log('Notifications are disabled.'); // Log message if notifications are turned off
    }
  } catch (error) {
    // Log any errors encountered while reading the test results or sending notifications
    console.error('Error reading test results file:', error.message);
  }
}

export default globalTeardown;
