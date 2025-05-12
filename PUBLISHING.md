# Publishing Guide for @plust/datasleuth

This document provides step-by-step instructions for publishing new versions of the @plust/datasleuth package to npm.

## Prerequisites

Before publishing, ensure you have:

1. An npm account with access to the `@plust` organization
2. Logged in to npm CLI with `npm login`
3. Verified your authentication with `npm whoami`
4. Completed all items in the [Release Checklist](./RELEASE-CHECKLIST.md)

## Publication Process

### 1. Prepare for Release

```bash
# Ensure you're on the main branch with latest changes
git checkout main
git pull origin main

# Install dependencies to ensure package-lock.json is up to date
npm ci

# Run validation checks
npm run validate
```

### 2. Increment Version

Based on the nature of changes, increment the version using one of these commands:

```bash
# For patch releases (bug fixes)
npm version patch -m "Bump version to %s"

# For minor releases (new features, backward compatible)
npm version minor -m "Bump version to %s"

# For major releases (breaking changes)
npm version major -m "Bump version to %s"
```

These commands will:
- Update the version in package.json
- Create a new git commit
- Create a git tag

### 3. Verify Package Contents

Run a dry-run to verify what will be included in the package:

```bash
npm run release:dry
```

Review the output carefully to ensure:
- Only necessary files are included
- No sensitive or development files are included
- The package size is reasonable

### 4. Publish to npm

#### Standard Release

For a standard release to the `latest` tag (default):

```bash
npm run release
```

#### Pre-release / Beta Version

For a pre-release version with the `next` tag:

```bash
npm run release:next
```

### 5. Verify Publication

Verify the package has been published successfully:

```bash
# Check the published version
npm view @plust/datasleuth version

# Check all published versions
npm view @plust/datasleuth versions

# Check package information
npm view @plust/datasleuth
```

### 6. Push Changes to GitHub

Push the version commit and tag:

```bash
git push origin main --tags
```

### 7. Create GitHub Release

1. Go to the [GitHub repository releases page](https://github.com/Jacques2Marais/datasleuth/releases)
2. Click "Draft a new release"
3. Select the tag you just pushed
4. Title the release "v{version}" (e.g., "v1.0.1")
5. Copy the relevant section from CHANGELOG.md into the description
6. Publish the release

## Handling Publication Errors

### Authentication Issues

If you encounter authentication errors:

```bash
# Re-login to npm
npm logout
npm login

# Verify you're logged in correctly
npm whoami
```

### Version Conflicts

If the version already exists:

```bash
# Check existing versions
npm view @plust/datasleuth versions

# Update your version number accordingly
npm version [new-version] -m "Bump version to %s"
```

### Other Issues

For other issues:

1. Check the npm logs: `npm logs`
2. Verify npm registry status: https://status.npmjs.org/
3. Reach out to the team for assistance

## Unpublishing (Emergency Only)

Unpublishing should be avoided, but if necessary (within 72 hours of publishing):

```bash
npm unpublish @plust/datasleuth@x.y.z
```

Note: This is disruptive to users and should only be done for critical issues like security vulnerabilities or accidental publication of sensitive information.

## Deprecating a Version

To mark a version as deprecated (preferred over unpublishing):

```bash
npm deprecate @plust/datasleuth@"1.0.0" "Critical security vulnerability, please update to 1.0.1"
```