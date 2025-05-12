# Contributing to @plust/datasleuth

Thank you for your interest in contributing to @plust/datasleuth! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Documentation Guidelines](#documentation-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Release Process](#release-process)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. We expect all contributors to be respectful and considerate of others.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally: `git clone https://github.com/YOUR-USERNAME/datasleuth.git`
3. Add the original repository as an upstream remote: `git remote add upstream https://github.com/Jacques2Marais/datasleuth.git`
4. Create a branch for your changes: `git checkout -b feature/your-feature-name`

## Development Setup

1. Install Node.js (version 16.x or later) and npm (version 8.x or later)
2. Navigate to the project directory: `cd datasleuth/packages/core`
3. Install dependencies: `npm install`
4. Build the project: `npm run build`
5. Run tests to verify setup: `npm test`

## Development Workflow

1. Make sure your branch is up to date with upstream: `git pull upstream main`
2. Make your changes
3. Run linting: `npm run lint`
4. Run formatting: `npm run format`
5. Run tests: `npm test`
6. Commit your changes with a descriptive message
7. Push to your fork: `git push origin feature/your-feature-name`
8. Create a pull request on GitHub

## Pull Request Process

1. Ensure your code follows the project's coding guidelines
2. Update documentation if necessary
3. Add/update tests for your changes
4. Make sure all tests, linting, and formatting checks pass
5. Fill out the pull request template completely
6. Request a review from maintainers
7. Address any feedback from reviewers
8. Once approved, a maintainer will merge your PR

## Coding Guidelines

- Follow TypeScript best practices
- Use functional programming patterns where appropriate
- Write code that is modular, reusable, and maintainable
- Ensure proper error handling and logging
- Keep functions small and focused on a single responsibility
- Use descriptive variable and function names
- Document all public APIs with JSDoc comments

## Documentation Guidelines

### JSDoc Comments

All public functions, classes, interfaces, and types must have JSDoc comments that include:

- A description of what the item does
- Parameter descriptions with types
- Return value description
- Examples of usage
- Exception information

Example:

```typescript
/**
 * Creates an analysis step for the research pipeline
 * 
 * This function creates a step that analyzes research data using AI to extract insights, 
 * identify patterns, and provide recommendations based on the specified focus area.
 * 
 * @param options - Configuration options for the analysis step
 * @param options.focus - The focus area for analysis (e.g., 'market-trends')
 * @param options.llm - Language model to use (falls back to state.defaultLLM if not provided)
 * @returns A configured analysis step for the research pipeline
 * 
 * @example
 * ```typescript
 * import { research, analyze } from '@plust/datasleuth';
 * 
 * const results = await research({
 *   query: "Impact of AI on healthcare",
 *   steps: [
 *     analyze({
 *       focus: 'ethical-considerations',
 *       llm: openai('gpt-4o')
 *     })
 *   ],
 *   outputSchema: outputSchema
 * });
 * ```
 */
```

### README and Other Documentation

- Keep documentation up to date
- Include examples for all major features
- Use proper markdown formatting
- Include diagrams or images where helpful
- Document all API endpoints and parameters
- Include troubleshooting information

## Testing Guidelines

- Write unit tests for all new functionality
- Maintain or improve test coverage
- Use mocks for external dependencies
- Test error cases and edge conditions
- Write integration tests for important workflows
- Keep tests fast and reliable

## Release Process

1. Update the version number in package.json
2. Update the CHANGELOG.md file
3. Run the full test suite
4. Generate documentation
5. Submit a PR for release preparation
6. Once merged, tag the release: `git tag v1.x.x`
7. Push the tag: `git push upstream v1.x.x`
8. Publish to npm: `npm publish`

Thank you for contributing to @plust/datasleuth!
