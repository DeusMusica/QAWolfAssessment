module.exports = {
    preset: 'jest-playwright-preset',
    testMatch: ['**/tests/**/*.jest.test.js'],
    testTimeout: 30000,
    reporters: [
        'default',
        ['jest-html-reporter', {
            pageTitle: 'Test Report',
            outputPath: './test-report.html',
            includeFailureMsg: true,
            includeConsoleLog: true
        }]
    ],
};

