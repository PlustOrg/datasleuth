#!/usr/bin/env node

/**
 * This script performs a security check on the package before publishing
 * to ensure we're not releasing anything with known vulnerabilities.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔒 Running security checks before publishing...');

try {
  // Run npm audit
  console.log('📊 Running npm audit...');
  const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
  const auditResult = JSON.parse(auditOutput);

  // Check for vulnerabilities
  const vulnerabilities = auditResult.vulnerabilities;
  const totalVulnerabilities = Object.values(vulnerabilities).reduce(
    (total, severity) => total + (typeof severity === 'number' ? severity : 0),
    0
  );

  if (totalVulnerabilities > 0) {
    console.log('⚠️ Vulnerabilities found:');

    // Show a breakdown of vulnerabilities by severity
    const severities = ['critical', 'high', 'moderate', 'low'];
    severities.forEach((severity) => {
      if (vulnerabilities[severity]) {
        console.log(`  - ${severity}: ${vulnerabilities[severity]}`);
      }
    });

    // Check for critical or high vulnerabilities
    if (vulnerabilities.critical || vulnerabilities.high) {
      console.error('❌ Critical or high severity vulnerabilities detected!');
      console.error('Please run "npm audit fix" or resolve these issues before publishing.');
      process.exit(1);
    } else {
      console.log('⚠️ Only moderate and low severity vulnerabilities found.');
      console.log('You can proceed with publication, but consider fixing these issues soon.');
    }
  } else {
    console.log('✅ No vulnerabilities found!');
  }

  // Check for sensitive files that shouldn't be published
  console.log('\n🔍 Checking for sensitive files...');
  const sensitivePatterns = [
    /\.env$/,
    /\.env\..+$/,
    /config.*\.json$/,
    /.*key.*\.json$/,
    /.*secret.*\.json$/,
    /.*password.*\.txt$/,
    /.*credential.*\.json$/,
  ];

  let sensitiveFilesFound = false;

  function scanForSensitiveFiles(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory() && file !== 'node_modules' && file !== 'dist') {
        scanForSensitiveFiles(filePath);
      } else if (stats.isFile()) {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(file)) {
            console.error(`❌ Potentially sensitive file found: ${filePath}`);
            sensitiveFilesFound = true;
            break;
          }
        }
      }
    }
  }

  scanForSensitiveFiles(path.join(__dirname, '..'));

  if (sensitiveFilesFound) {
    console.error('⚠️ Potentially sensitive files were found.');
    console.error('Please review these files and ensure they should be published,');
    console.error('or add them to .npmignore if they should not be included.');
  } else {
    console.log('✅ No sensitive files detected!');
  }

  // Check package size
  console.log('\n📦 Checking package size...');
  const packOutput = execSync('npm pack --dry-run', { encoding: 'utf8' });
  const sizeMatch = packOutput.match(/(?:.*?)\s+(\d+(?:\.\d+)?)\s*kB/);

  if (sizeMatch && sizeMatch[1]) {
    const packageSizeKB = parseFloat(sizeMatch[1]);
    console.log(`📊 Package size: ${packageSizeKB.toFixed(2)} kB`);

    if (packageSizeKB > 1000) {
      console.error('⚠️ Package is quite large (>1MB). Consider reducing the package size');
      console.error('by reviewing the included files or adding more entries to .npmignore.');
    } else if (packageSizeKB > 500) {
      console.log('⚠️ Package is moderately large (>500KB). Consider reviewing included files.');
    } else {
      console.log('✅ Package size is reasonable.');
    }
  } else {
    console.log('⚠️ Could not determine package size.');
  }

  console.log('\n🎉 Security checks completed!');
} catch (error) {
  console.error('❌ Error running security checks:', error.message);
  process.exit(1);
}
