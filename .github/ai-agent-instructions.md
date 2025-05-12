# @plust/datasleuth AI Agent Onboarding Guide

This document provides a concise overview of the `@plust/datasleuth` npm package
to help an AI coding agent understand its purpose, features, and basic usage.

## Package Overview

`@plust/datasleuth` is a powerful deep research tool designed for gathering and
synthesizing information using AI. It enables developers to conduct
comprehensive research on any topic through a simple functional API. The package
returns structured results based on a user-specified output schema, processed
via a modular and configurable pipeline of research steps.

## Key Goals & Project Requirements

- **Goal**: To build a deep research tool as an npm package.
- **Functionality**: Users provide a search query and an output schema (using
  Zod). The package then delivers structured research results.
- **Architecture**: Pipeline-based, with a core `research()` API, a pipeline
  engine for sequential step execution, modular research steps, and Zod-based
  schema validation.
- **Core Technologies**: TypeScript, Node.js.
- **Key Dependencies**:
  - `mastra` (for AI agents)
  - `zod` (for schema validation)
  - `ai` SDK (Vercel AI SDK for LLM integration)
  - `@plust/search-sdk` (for web searches)

## Installation

Install the package using npm:

```bash
npm install @plust/datasleuth
```

Or using yarn:

```bash
yarn add @plust/datasleuth
```

## Core Concepts

- **`research(options)` function**: The main entry point. Takes a `query`,
  `outputSchema`, optional `steps`, `defaultLLM`, and `config`.
- **Pipeline Steps**: Modular functions for various research tasks (e.g.,
  `plan`, `searchWeb`, `extractContent`, `analyze`, `factCheck`, `summarize`).
- **Output Schema**: Defined using Zod, this dictates the structure of the
  research results.
- **LLM Integration**: Leverages the Vercel AI SDK, allowing use of various LLMs
  (OpenAI, Anthropic, Google, etc.).
- **Search Providers**: Integrates with search SDKs like `@plust/search-sdk` for
  web searches (e.g., Google). API keys for these services should be managed via
  environment variables.

## Key Features

- 🔍 **Comprehensive Research**: Intelligent research pipelines.
- 🤖 **AI-Powered Planning**: Automatic generation of research plans.
- 🌐 **Web Integration**: Connects to search engines and content sources.
- 📊 **Deep Analysis**: AI-driven information extraction and analysis.
- 🔄 **Adaptive Research**: Feedback loops for refining queries.
- 📚 **Structured Results**: Schema-validated, consistent data output.
- 🔧 **Extensible Architecture**: Custom research steps and tools.
- 🧠 **Multiple LLM Support**: Via Vercel AI SDK.
- 🚀 **Parallel Processing**: Concurrent research tracks.
- 🔍 **Fact Checking**: AI-powered verification.
- 📈 **Entity Analysis**: Classification and clustering of entities.

## Basic Usage Example

```typescript
import { research } from '@plust/datasleuth';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai'; // Vercel AI SDK

// 1. Define the desired output structure
const outputSchema = z.object({
  summary: z.string().describe('A concise summary of the findings.'),
  keyFindings: z.array(z.string()).describe('A list of key findings.'),
  sources: z
    .array(z.string().url())
    .describe('A list of URLs for the sources found.'),
});

// 2. Set up your research query and parameters
const query = 'Latest advancements in quantum computing';

// 3. Execute the research
async function runMyResearch() {
  try {
    const results = await research({
      query: query,
      outputSchema: outputSchema,
      defaultLLM: openai('gpt-4o'), // Specify a default LLM
      // For more complex scenarios, custom steps can be provided:
      // steps: [
      //   plan({ llm: openai('gpt-4o') }),
      //   searchWeb({ provider: googleSearchProvider, maxResults: 5 }),
      //   extractContent({ selectors: 'article, .main, .content' }),
      //   summarize({ llm: openai('gpt-3.5-turbo') })
      // ]
    });

    // 4. Process the results
    console.log('Research Summary:', results.summary);
    console.log('Key Findings:', results.keyFindings);
    console.log('Sources:', results.sources);
  } catch (error) {
    console.error('Research failed:', error);
    // Handle specific error types if needed (e.g., ConfigurationError, ValidationError)
  }
}

// Ensure API keys (e.g., OPENAI_API_KEY) are set in your environment
// import dotenv from 'dotenv';
// dotenv.config();

runMyResearch();
```

## Environment Setup for API Keys

It's crucial to manage API keys securely, typically via environment variables.

1.  Create a `.env` file in your project root:
    ```env
    OPENAI_API_KEY="your_openai_api_key"
    GOOGLE_API_KEY="your_google_api_key" # If using Google Search
    GOOGLE_CX="your_google_search_engine_id"  # If using Google Search
    # Add other keys as needed
    ```
2.  Load these variables in your application (e.g., using `dotenv` package):
    ```typescript
    import dotenv from 'dotenv';
    dotenv.config();
    ```

## Key Research Steps (Examples)

- `plan({ llm, customPrompt })`: Creates a research plan.
- `searchWeb({ provider, maxResults })`: Searches the web. Requires a configured
  search provider (e.g., from `@plust/search-sdk`).
- `extractContent({ selectors, maxUrls })`: Extracts content from web pages.
- `analyze({ llm, focus, depth })`: Performs specialized analysis.
- `factCheck({ llm, threshold })`: Validates information.
- `summarize({ llm, maxLength, format })`: Synthesizes information.
- `evaluate({ criteriaFn })`: Evaluates current state against criteria.
- `repeatUntil(conditionStep, stepsToRepeat)`: Repeats steps until a condition
  is met.
- `parallel({ tracks, mergeFunction })`: Executes multiple research tracks
  concurrently.
- `track({ name, steps })`: Defines an isolated research track.
- `orchestrate({ llm, tools, customPrompt })`: Uses AI agents to dynamically
  decide research steps.

## Error Handling

The package defines several custom error types (e.g., `ConfigurationError`,
`ValidationError`, `LLMError`, `SearchError`). These errors provide descriptive
messages and details. Implement `try...catch` blocks to handle potential errors
gracefully.

```typescript
import {
  BaseResearchError,
  ConfigurationError,
  ValidationError,
} from '@plust/datasleuth';

try {
  // ... research call
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Configuration Error:', error.message, error.details);
  } else if (error instanceof ValidationError) {
    console.error('Validation Error:', error.message, error.details);
  } else if (error instanceof BaseResearchError) {
    console.error('Datasleuth Research Error:', error.message);
  } else {
    console.error('An unexpected error occurred:', error);
  }
}
```

## Further Information

For more detailed API references, advanced examples, and troubleshooting,
consult the full documentation within the `@plust/datasleuth` package (typically
in a `docs/` directory or the `README.md`). The existing
`.github/copilot-instructions.md` file also contains a wealth of information on
architecture, coding patterns, and specific TypeScript best practices for this
project.
