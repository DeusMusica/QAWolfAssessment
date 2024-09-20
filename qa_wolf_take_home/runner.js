import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { platform } from 'os';

// Define the path to the `dashboard.html` file
const htmlFilePath = path.resolve('dashboard.html');

// Define the paths to trace files for each browser
const tracePaths = {
  chromium: path.resolve('trace-chromium.zip'),
  firefox: path.resolve('trace-firefox.zip'),
  webkit: path.resolve('trace-webkit.zip')
};

/**
 * Get the correct `npx` command based on the operating system.
 * @returns {string} The correct npx command for the current platform.
 */
function getNpxCommand() {
  return platform() === 'win32' ? 'npx.cmd' : 'npx';
}

/**
 * Run a shell command using a child process and log the execution details.
 * @param {string} command - The command to run.
 * @param {Array} args - The arguments for the command.
 * @param {string} description - A description of the command being run for logging purposes.
 * @returns {Promise<void>} A promise that resolves when the command completes successfully.
 */
function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${description}`);

    // Spawn a new process to execute the command
    const cmd = spawn(command, args, { stdio: 'inherit' });

    // Handle process error event
    cmd.on('error', (err) => {
      console.error(`Failed to run ${description}:`, err);
      reject(err);
    });

    // Handle process close event
    cmd.on('close', (code) => {
      if (code !== 0) {
        console.error(`${description} exited with code ${code}`);
        reject(new Error(`${description} exited with code ${code}`));
      } else {
        console.log(`${description} completed successfully.`);
        resolve();
      }
    });
  });
}

/**
 * Introduce a delay between tasks.
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Opens the Playwright trace files for each browser using the `npx playwright show-trace` command.
 * Ensures that each trace file exists before attempting to open it.
 */
async function openTraceFiles() {
  const npxCommand = getNpxCommand();

  // Iterate through each browser and trace file path
  for (const [browser, tracePath] of Object.entries(tracePaths)) {
    if (existsSync(tracePath)) {
      console.log(`Opening trace for ${browser}: ${tracePath}`);
      // Run the Playwright `show-trace` command to view the trace
      await runCommand(npxCommand, ['playwright', 'show-trace', tracePath], `Open ${browser} trace`);
    } else {
      console.warn(`Trace file not found for ${browser}: ${tracePath}`);
    }
  }
}

/**
 * Starts an HTTP server using `http-server` to serve the `dashboard.html` file.
 * Ensures that the `dashboard.html` file exists before starting the server.
 * Opens a new Chrome window automatically to display the dashboard.
 */
function startServer() {
  // Verify that the dashboard.html file exists
  if (!existsSync(htmlFilePath)) {
    console.error(`Dashboard file not found at: ${htmlFilePath}`);
    process.exit(1);  // Exit if the file is missing
  }

  // Determine the correct `npx` command for the platform
  const npxCommand = getNpxCommand();

  // Spawn a process to run `http-server` on port 8080
  const serverProcess = spawn(npxCommand, ['http-server', '-p', '8080'], { stdio: 'inherit' });

  // Handle errors when starting the server
  serverProcess.on('error', (err) => {
    console.error('Failed to start the server:', err);
  });

  // Log server exit code if it closes unexpectedly
  serverProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Server process exited with code ${code}`);
    }
  });

  // Once the server is ready, open the dashboard in a new Chrome window
  serverProcess.on('spawn', () => {
    console.log('Server started. Opening Chrome browser...');
    openChromeBrowser('http://localhost:8080');  // Open the Chrome browser with the server URL
  });
}

/**
 * Opens the specified URL in a new Chrome browser window.
 * Works across different operating systems (Windows, macOS, Linux).
 * 
 * @param {string} url - The URL to open in Chrome.
 */
function openChromeBrowser(url) {
  const chromePaths = {
    win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: 'google-chrome' // Assuming Chrome is in PATH on Linux
  };

  const chromeCommand = chromePaths[platform()];

  if (chromeCommand && existsSync(chromeCommand)) {
    // Use spawn to open Chrome with the given URL
    spawn(chromeCommand, [url], { stdio: 'inherit' });
  } else {
    console.error('Chrome browser not found on this system.');
  }
}

/**
 * Main runner function that executes all tasks sequentially:
 * 1. Run the article scraper (index.js).
 * 2. Run the Playwright tests.
 * 3. Open the Playwright trace files.
 * 4. Start the HTTP server to display the dashboard and open Chrome automatically.
 */
async function run() {
  try {
    console.log('Step 1: Running index.js to scrape articles.');
    await runCommand('node', ['index.js'], 'Article Scraper (index.js)');

    // Add a short delay before running the tests
    await delay(3000); // 3-second delay

    console.log('Step 2: Running Playwright tests to update testResults.json.');
    const playwrightPath = path.resolve('node_modules', '.bin', platform() === 'win32' ? 'playwright.cmd' : 'playwright');
    await runCommand(playwrightPath, ['test'], 'Playwright Tests');

    // Add another delay before opening trace files
    await delay(3000); // 3-second delay

    console.log('Step 3: Opening trace files.');
    await openTraceFiles();  // Open the Playwright trace files after the tests are complete

    console.log('Step 4: Starting HTTP server to display dashboard and opening Chrome.');
    startServer();  // Start the HTTP server and automatically open the dashboard in Chrome
  } catch (error) {
    console.error('Error during runner execution:', error);
  }
}

// Execute the runner
run();
