#!/usr/bin/env node
/**
 * Documentation publishing script for @plust/datasleuth
 *
 * This script automates the process of publishing API documentation to GitHub Pages.
 * It copies the generated documentation to a temporary directory, adds necessary files
 * for GitHub Pages, and uses gh-pages to publish the content.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const sourceDir = path.join(__dirname, '..', 'docs', 'api');
const tempDir = path.join(__dirname, '..', 'docs-site');
const ghPagesOptions = {
  branch: 'gh-pages',
  repo: process.env.GH_PAGES_REPO || undefined, // Uses the default origin if not specified
  message: 'Auto-update documentation [ci skip]',
  user: {
    name: process.env.GH_PAGES_NAME || 'Documentation Bot',
    email: process.env.GH_PAGES_EMAIL || 'docs-bot@example.com',
  },
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Main function to publish documentation
 */
async function publishDocs() {
  try {
    console.log(`${colors.cyan}Starting documentation publishing process...${colors.reset}`);

    // Check if docs directory exists
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Documentation directory not found: ${sourceDir}`);
    }

    // Ensure gh-pages is installed
    console.log(`${colors.blue}Checking for gh-pages package...${colors.reset}`);
    try {
      // In ESM we can't use require.resolve, so we'll check another way
      execSync('npm list gh-pages || npm install --no-save gh-pages', { stdio: 'inherit' });
    } catch (e) {
      console.log(`${colors.yellow}Installing gh-pages package...${colors.reset}`);
      execSync('npm install --no-save gh-pages', { stdio: 'inherit' });
    }

    // Create temporary directory
    if (fs.existsSync(tempDir)) {
      console.log(`${colors.yellow}Cleaning previous temporary directory...${colors.reset}`);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Copy docs to temporary directory
    console.log(`${colors.blue}Copying documentation to temporary directory...${colors.reset}`);
    fs.mkdirSync(tempDir, { recursive: true });
    execSync(`cp -r ${sourceDir}/* ${tempDir}/`, { stdio: 'inherit' });

    // Create .nojekyll file to prevent GitHub Pages from processing with Jekyll
    fs.writeFileSync(path.join(tempDir, '.nojekyll'), '');

    // Create CNAME file if custom domain is configured
    if (process.env.GH_PAGES_CNAME) {
      console.log(
        `${colors.blue}Setting up custom domain: ${process.env.GH_PAGES_CNAME}${colors.reset}`
      );
      fs.writeFileSync(path.join(tempDir, 'CNAME'), process.env.GH_PAGES_CNAME);
    }

    // Add redirect in case the docs are accessed at the root
    const redirectHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>@plust/datasleuth API Documentation</title>
          <meta http-equiv="refresh" content="0; url=./index.html">
        </head>
        <body>
          <p>Redirecting to <a href="./index.html">API documentation</a>...</p>
        </body>
      </html>
    `;
    fs.writeFileSync(path.join(tempDir, 'redirect.html'), redirectHtml.trim());

    // Publish to GitHub Pages
    console.log(`${colors.blue}Publishing to GitHub Pages...${colors.reset}`);

    // Import gh-pages dynamically (ESM style)
    const ghpages = await import('gh-pages');

    await new Promise((resolve, reject) => {
      ghpages.publish(tempDir, ghPagesOptions, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    console.log(`${colors.green}✅ Documentation published successfully!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Error publishing documentation:${colors.reset}`);
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup temporary directory
    if (fs.existsSync(tempDir)) {
      console.log(`${colors.blue}Cleaning up temporary directory...${colors.reset}`);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// Execute the publishing function
publishDocs();
