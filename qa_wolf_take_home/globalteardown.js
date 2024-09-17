import fs from 'fs';
import nodemailer from 'nodemailer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

// Function to send email notifications
async function sendEmailNotification(summary) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,  // Use environment variable for email
      pass: process.env.EMAIL_PASS,  // Use environment variable for app password
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,  // From your Gmail address
    to: process.env.EMAIL_USER,  // Recipient email address
    subject: 'Playwright Test Results Summary',
    text: summary,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email notification sent!');
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

// Function to send Slack notifications
async function sendSlackNotification(summary) {
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

  if (!SLACK_WEBHOOK_URL) {
    console.error('SLACK_WEBHOOK_URL is undefined or invalid');
    return;
  }

  try {
    await axios.post(SLACK_WEBHOOK_URL, {
      text: summary,  // The message content sent to Slack
    });
    console.log('Slack notification sent successfully!');
  } catch (error) {
    console.error('Failed to send Slack notification:', error.response ? error.response.data : error.message);
  }
}

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

    // Generate summary by test
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

    // Output to console (optional) and send notifications
    console.log(summary);

    // Send email and slack notifications
    await sendEmailNotification(summary);  // Example function to send email
    await sendSlackNotification(summary);  // Example function to send slack

  } catch (error) {
    console.error('Error reading test results file:', error);
  }
}

export default globalTeardown;
