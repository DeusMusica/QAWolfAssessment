import { exec } from 'child_process';
import open from 'open';  // For opening the dashboard in the browser
import fs from 'fs';

// ------------------ Helper Functions ------------------

/**
 * Function to execute Playwright tests with styled output.
 * Uses the 'dot' reporter to show test progress.
 */
async function runTests() {
  return new Promise((resolve, reject) => {
    // Execute Playwright tests using npx with the 'dot' reporter for minimal styled output
    const process = exec('npx playwright test --reporter=dot', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running tests: ${error}`);
        reject(error);
      } else {
        console.log('Test run complete');
        resolve();
      }
    });

    // Output the test progress in real-time
    process.stdout.on('data', data => {
      console.log(data);  // Display 'dot' style test progress
    });

    process.stderr.on('data', data => {
      console.error(`Error: ${data}`);
    });
  });
}

/**
 * Function to start a local HTTP server and open the dashboard.
 */
async function startDashboard() {
  return new Promise((resolve, reject) => {
    // Start an HTTP server to serve the dashboard.html
    const serverProcess = exec('npx http-server -p 8080', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error starting server: ${error}`);
        reject(error);
      } else {
        console.log('Server started on http://localhost:8080/dashboard.html');
        resolve();
      }
    });

    // Open the dashboard in the default browser
    open('http://localhost:8080/dashboard.html').catch(err => {
      console.error(`Error opening the dashboard: ${err}`);
    });
  });
}

/**
 * Function to collect and store test results to a JSON file.
 */
async function storeTestResults() {
  const resultsFilePath = 'testResults.json';
  
  if (fs.existsSync(resultsFilePath)) {
    try {
      // Read and parse the test results from the JSON file
      const data = fs.readFileSync(resultsFilePath, 'utf8');
      const testResults = JSON.parse(data);

      // Handle performance data warnings
      testResults.forEach(result => {
        if (!result.performance) {
          console.warn(`Missing performance data for test: ${result.test}`);
        }
      });

    } catch (error) {
      console.error('Error reading or parsing test results:', error);
    }
  } else {
    console.error('Test results file not found.');
  }
}

// ------------------ Main Execution Flow ------------------

/**
 * Main function to run tests, store results, and start the dashboard.
 */
async function main() {
  try {
    // Step 1: Run Playwright tests with styled output
    await runTests();

    // Step 2: Store the test results
    await storeTestResults();

    // Step 3: Start the dashboard server
    await startDashboard();
  } catch (error) {
    console.error('Error in runner script:', error);
  }
}

// Run the main function
main();
