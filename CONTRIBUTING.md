# Contributing to @plust/datasleuth

Thank you for your interest in contributing to @plust/datasleuth! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Development Environment Setup](#development-environment-setup)
  - [Project Structure](#project-structure)
- [Development Process](#development-process)
  - [Feature Branches](#feature-branches)
  - [Coding Standards](#coding-standards)
  - [Testing](#testing)
  - [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
  - [Pull Requests](#pull-requests)
  - [Review Process](#review-process)
- [Release Process](#release-process)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm (v7+) or yarn (v1.22+)
- Git

### Development Environment Setup

1. Fork the repository
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/datasleuth.git
   cd datasleuth
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up development environment:
   ```bash
   npm run setup:dev
   ```
5. Create a branch for your contribution:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Project Structure

The codebase is organized as follows:

```
packages/core/
├── docs/               # Documentation
│   ├── api/            # API reference
│   └── ...
├── examples/           # Usage examples
│   ├── basic-research.ts
│   └── ...
├── src/                # Source code
│   ├── core/           # Core functionality
│   ├── steps/          # Research pipeline steps
│   ├── tools/          # Integration tools
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── validators/     # Schema validators
├── tests/              # Test suite
│   ├── mocks/          # Test mocks
│   └── ...
└── ...
```

## Development Process

### Feature Branches

We use a feature branch workflow:

1. Create a branch from `main` for your feature/fix
2. Implement your changes
3. Submit a pull request back to `main`

### Coding Standards

We follow TypeScript best practices and use ESLint and Prettier for code quality:

- All code should be written in TypeScript
- Follow the existing code style
- Use meaningful variable names and comments
- Add proper JSDoc documentation to public APIs
- Run `npm run lint` before committing to ensure your code meets our standards

Key coding patterns to follow:

1. **Factory Function Pattern**: Create steps using factory functions.
   ```typescript
   export function myStep(options: MyStepOptions = {}): ReturnType<typeof createStep> {
     return createStep('MyStep', executeMyStep, options);
   }
   ```

2. **Immutable State Transformation**: Don't modify state directly.
   ```typescript
   function executeStep(state: ResearchState, options: StepOptions): Promise<ResearchState> {
     return {
       ...state,
       data: {
         ...state.data,
         newData: processedResult
       }
     };
   }
   ```

3. **Options Pattern**: Use optional configuration objects with defaults.
   ```typescript
   interface MyOptions {
     param1?: string;
     param2?: number;
   }
   
   function myFunction(options: MyOptions = {}) {
     const { param1 = 'default', param2 = 42 } = options;
     // Implementation
   }
   ```

### Testing

All new features and fixes should include tests:

1. Unit tests for isolated functionality
2. Integration tests for complex interactions
3. Run tests with `npm test` before submitting PR

Test coverage should be maintained or improved with each contribution.

#### Writing Tests

- Use Jest for testing
- Create mocks for external dependencies
- Test both success and error cases
- Verify edge cases and input validation

Example:

```typescript
describe('myFunction', () => {
  it('should process valid input correctly', () => {
    // Test implementation
  });
  
  it('should handle empty input gracefully', () => {
    // Test implementation
  });
  
  it('should throw appropriate error for invalid input', () => {
    // Test implementation
  });
});
```

### Documentation

Documentation is a crucial part of this project:

- Add JSDoc comments to all exported functions, classes, and interfaces
- Update relevant README sections when adding features
- Add usage examples for new functionality
- Update API documentation for interface changes
- Keep the CHANGELOG.md updated with notable changes

## Submitting Changes

### Pull Requests

When submitting a pull request:

1. Update relevant documentation
2. Add tests for new functionality
3. Ensure all tests pass
4. Update the CHANGELOG.md with your changes under the "Unreleased" section
5. Fill in the pull request template completely

### Review Process

All submissions require review before being merged:

1. Automated checks must pass (tests, linting, type checking)
2. At least one core maintainer must approve changes
3. Address feedback and make requested changes
4. Once approved, a maintainer will merge your PR

## Release Process

The project follows semantic versioning:

- MAJOR version for incompatible API changes
- MINOR version for backward-compatible functionality additions
- PATCH version for backward-compatible bug fixes

## Community

- Join our [Discord server](https://discord.gg/example) for discussions
- Check the [GitHub issues](https://github.com/example/datasleuth/issues) for ways to contribute
- Report bugs and request features through GitHub issues

Thank you for contributing to @plust/datasleuth!
