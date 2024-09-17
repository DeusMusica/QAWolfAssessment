import { exec } from 'child_process';
import open from 'open';  // for opening the dashboard in the browser
import fs from 'fs';

// Function to execute Playwright tests across all browsers
async function runTests() {
  return new Promise((resolve, reject) => {
    const process = exec('npx playwright test', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running tests: ${error}`);
        reject(error);
      } else {
        console.log('Test run complete');
        resolve();
      }
    });

    process.stdout.on('data', data => {
      console.log(data);
    });

    process.stderr.on('data', data => {
      console.error(`Error: ${data}`);
    });
  });
}

// Function to start a local server and open the custom dashboard
async function startDashboard() {
  return new Promise((resolve, reject) => {
    const serverProcess = exec('npx http-server -p 8080', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error starting server: ${error}`);
        reject(error);
      } else {
        console.log('Custom server started on http://localhost:8080/dashboard.html');
        resolve();
      }
    });

    // Open the custom dashboard in the browser
    open('http://localhost:8080/dashboard.html').then(() => {
      console.log('Custom dashboard opened in browser');
    });
  });
}

// Function to collect and store test results to a JSON file
async function storeTestResults() {
  const resultsFilePath = 'testResults.json';
  if (fs.existsSync(resultsFilePath)) {
    console.log('Test results found, storing...');

    // Read and parse the test results
    const data = fs.readFileSync(resultsFilePath, 'utf8');
    const testResults = JSON.parse(data);

    testResults.forEach(result => {
      if (!result.performance) {
        console.warn(`Missing performance data for test: ${result.test}`);
      }
    });

    // Store the test results
    console.log('Storing test results:', JSON.stringify(testResults, null, 2));
  } else {
    console.error('Test results file not found.');
  }
}

// Main function to run the whole process
async function main() {
  try {
    // Step 1: Run Playwright tests
    await runTests();

    // Step 2: Store test results (optional for storing results)
    await storeTestResults();

    // Step 3: Start the custom dashboard server and show it
    await startDashboard();

    // No Playwright dashboard being opened here
  } catch (error) {
    console.error('Error in runner script:', error);
  }
}

// Run the main function
main();
