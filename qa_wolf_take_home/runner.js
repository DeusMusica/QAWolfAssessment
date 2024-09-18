import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { platform } from 'os';

// Path to your existing `dashboard.html` file
const htmlFilePath = path.resolve('dashboard.html');

// Function to run commands and spawn child processes
function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${description}`);
    const cmd = spawn(command, args, { stdio: 'inherit' });

    cmd.on('error', (err) => {
      console.error(`Failed to run ${description}:`, err);
      reject(err);
    });

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

// Function to start the HTTP server
function startServer() {
  // Ensure the dashboard.html file exists before starting the server
  if (!existsSync(htmlFilePath)) {
    console.error(`Dashboard file not found at: ${htmlFilePath}`);
    process.exit(1);
  }

  // Get the path to npx based on the OS platform
  const npxCommand = platform() === 'win32' ? 'npx.cmd' : 'npx';

  // Use the correct command for `npx` to dynamically run `http-server`
  const serverProcess = spawn(npxCommand, ['http-server', '-p', '8080'], { stdio: 'inherit' });

  serverProcess.on('error', (err) => {
    console.error('Failed to start the server:', err);
  });

  serverProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Server process exited with code ${code}`);
    }
  });
}

// Main runner function to execute all steps
async function run() {
  try {
    console.log('Step 1: Running index.js to scrape articles.');
    await runCommand('node', ['index.js'], 'Article Scraper (index.js)');

    console.log('Step 2: Running Playwright tests to update testResults.json.');

    // Use the full path to Playwright to avoid issues with npx
    const playwrightPath = path.resolve('node_modules', '.bin', platform() === 'win32' ? 'playwright.cmd' : 'playwright');
    await runCommand(playwrightPath, ['test'], 'Playwright Tests');

    console.log('Step 3: Starting HTTP server to display dashboard.');
    startServer();
  } catch (error) {
    console.error('Error during runner execution:', error);
  }
}

// Execute the runner
run();
