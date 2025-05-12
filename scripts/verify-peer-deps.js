#!/usr/bin/env node

/**
 * This script verifies that all peer dependencies are correctly specified.
 * Run this before publishing to avoid dependency issues for users.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// The dependencies we expect to be used as peer dependencies
const potentialPeerDeps = ['ai', 'zod'];

// Check if the package JSON has peerDependencies
if (!packageJson.peerDependencies) {
  packageJson.peerDependencies = {};
}

// Check imports in source files to detect usage of potential peer dependencies
const srcDir = path.join(__dirname, '../src');
let hasChanges = false;

console.log('🔍 Checking for potential peer dependencies...');

// Function to recursively scan directory for import statements
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      scanDirectory(filePath);
    } else if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts')) {
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for import statements of potential peer dependencies
      for (const dep of potentialPeerDeps) {
        // Match imports like: import X from 'dep' or import { X } from 'dep'
        const regex = new RegExp(
          `import\\s+(?:{[^}]*}|[^{][^\\n]*)\\s+from\\s+['"]${dep}(?:/[^'"]*)?['"]`,
          'g'
        );
        if (regex.test(content) && !packageJson.peerDependencies[dep]) {
          console.log(
            `⚠️  Found usage of '${dep}' in ${filePath.replace(path.join(__dirname, '..'), '')}`
          );

          // Get the version from dependencies
          const version = packageJson.dependencies[dep] || '*';

          // Add to peerDependencies
          packageJson.peerDependencies[dep] = version;
          console.log(`✅ Added ${dep}@${version} to peerDependencies`);

          // Remove from dependencies
          if (packageJson.dependencies[dep]) {
            delete packageJson.dependencies[dep];
            console.log(`🗑️  Removed ${dep} from dependencies`);
          }

          hasChanges = true;
        }
      }
    }
  }
}

// Start scanning the src directory
scanDirectory(srcDir);

// Write changes back to package.json if needed
if (hasChanges) {
  console.log('📝 Updating package.json with peer dependencies...');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✅ package.json updated successfully!');
} else {
  console.log('✅ No changes needed to peer dependencies!');
}

// Verify that all peer dependencies are installed (as dev dependencies)
console.log('🔍 Verifying installation of peer dependencies as dev dependencies...');
for (const [dep, version] of Object.entries(packageJson.peerDependencies)) {
  if (!packageJson.devDependencies[dep]) {
    console.log(
      `⚠️  Peer dependency ${dep}@${version} not found in devDependencies. Installing...`
    );
    try {
      execSync(`npm install --save-dev ${dep}@${version.replace(/[\^~]/, '')}`, {
        stdio: 'inherit',
      });
      console.log(`✅ Installed ${dep} as a dev dependency`);
    } catch (error) {
      console.error(`❌ Failed to install ${dep}: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(`✅ Peer dependency ${dep} already installed as dev dependency`);
  }
}

console.log('🎉 Peer dependency verification complete!');
