# Getting Started with @plust/datasleuth

This guide will help you quickly set up and run your first research project with @plust/datasleuth.

## Installation

Install the package using npm:

```bash
npm install @plust/datasleuth
```

Or using yarn:

```bash
yarn add @plust/datasleuth
```

## Quick Start Example

Here's a minimal example to get you started:

```typescript
import { research } from '@plust/datasleuth';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

// Define your output schema
const outputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  sources: z.array(z.string().url())
});

// Execute research with the default pipeline
async function runResearch() {
  try {
    const results = await research({
      query: "Latest advancements in quantum computing",
      outputSchema,
      defaultLLM: openai('gpt-4o')
    });
    
    console.log("Research Summary:", results.summary);
    console.log("Key Findings:", results.keyFindings);
    console.log("Sources:", results.sources);
  } catch (error) {
    console.error("Research failed:", error);
  }
}

runResearch();
```

## Setting Up Search Providers

To enable web searches, configure a search provider:

```typescript
import { research, searchWeb, extractContent } from '@plust/datasleuth';
import { z } from 'zod';
import { google } from '@plust/search-sdk';
import { openai } from '@ai-sdk/openai';

// Configure Google search
const googleSearch = google.configure({
  apiKey: process.env.GOOGLE_API_KEY,
  cx: process.env.GOOGLE_CX  // Your search engine ID
});

// Define your output schema
const outputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  sources: z.array(z.string().url())
});

// Execute research with custom steps
const results = await research({
  query: "Renewable energy trends 2025",
  outputSchema,
  defaultLLM: openai('gpt-4o'),
  steps: [
    searchWeb({ provider: googleSearch, maxResults: 10 }),
    extractContent({ selectors: 'article, .content, main' }),
    // Other steps...
  ]
});
```

## Environment Setup

It's recommended to store API keys in environment variables:

1. Create a `.env` file in your project root:

```
OPENAI_API_KEY=your_openai_key_here
GOOGLE_API_KEY=your_google_key_here
GOOGLE_CX=your_google_search_engine_id_here
```

2. Load environment variables in your application:

```typescript
import dotenv from 'dotenv';
dotenv.config();

// Now process.env.OPENAI_API_KEY, etc. are available
```

## Next Steps

- Check the [API Documentation](./docs/api/index.md) for detailed information on all functions
- Explore [Examples](./examples/) for more complex use cases
- Read the [Troubleshooting Guide](./docs/troubleshooting.md) if you encounter issues

Happy researching! 🔍✨