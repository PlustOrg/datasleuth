# @plust/datasleuth

Build LLM-powered research pipelines and output structured data.

DataSleuth is a modular AI-powered research engine that transforms natural
language queries into structured, validated data. It orchestrates information
gathering, fact checking, analysis, and synthesis using customizable pipelines
and LLM integration to deliver research results in your specified format.

![npm version](https://img.shields.io/npm/v/@plust/datasleuth)
![license](https://img.shields.io/npm/l/@plust/datasleuth)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)

> Note: This project is still early in its development. Please feel free to test
> it out and to contribute, but note that breaking changes may occur.

## Table of Contents

- [@plust/datasleuth](#plustdatasleuth)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Key Features](#key-features)
  - [Quick Start](#quick-start)
  - [Usage Examples](#usage-examples)
    - [Basic Research](#basic-research)
    - [Advanced Research](#advanced-research)
    - [LLM Integration with Vercel AI SDK](#llm-integration-with-vercel-ai-sdk)
    - [Parallel Research](#parallel-research)
    - [Agent Orchestration](#agent-orchestration)
  - [API Reference](#api-reference)
    - [Core Functions](#core-functions)
      - [`research(options)`](#researchoptions)
    - [Pipeline Steps](#pipeline-steps)
      - [`plan(options?)`](#planoptions)
      - [`searchWeb(options)`](#searchweboptions)
      - [`extractContent(options?)`](#extractcontentoptions)
      - [`factCheck(options?)`](#factcheckoptions)
      - [`analyze(options?)`](#analyzeoptions)
      - [`summarize(options?)`](#summarizeoptions)
      - [`evaluate(options)`](#evaluateoptions)
      - [`repeatUntil(conditionStep, stepsToRepeat, options?)`](#repeatuntilconditionstep-stepstorepeat-options)
      - [`parallel(options)`](#paralleloptions)
      - [`track(options)`](#trackoptions)
      - [`orchestrate(options)`](#orchestrateoptions)
      - [`transform(options?)`](#transformoptions)
    - [Utilities](#utilities)
      - [`ResultMerger`](#resultmerger)
  - [Error Handling](#error-handling)
  - [Troubleshooting](#troubleshooting)
  - [Contributing](#contributing)
  - [License](#license)

## Installation

```bash
npm install @plust/datasleuth
```

## Key Features

- **Comprehensive Research**: Go beyond simple searches with intelligent
  research pipelines
- **AI-Powered Planning**: Automatically generate research plans and strategies
- **Web Integration**: Connect to search engines and content sources
- **Deep Analysis**: Extract and analyze information with AI
- **Adaptive Research**: Refine queries and follow leads with feedback loops
- **Structured Results**: Get consistently formatted data with schema validation
- **Extensible Architecture**: Build custom research steps and tools
- **Multiple LLM Support**: Integrate with any AI provider through Vercel AI SDK
- **Parallel Processing**: Run multiple research tracks concurrently
- **Fact Checking**: Validate findings with AI-powered verification
- **Entity Analysis**: Classify and cluster entities in research data

## Quick Start

```typescript
import { research } from '@plust/datasleuth';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

// Define the structure of your research results
const outputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  sources: z.array(z.string().url()),
});

// Execute research
const results = await research({
  query: 'Latest advancements in quantum computing',
  outputSchema,
  defaultLLM: openai('gpt-4o'),
});

console.log(results);
```

## Usage Examples

### Basic Research

The simplest way to use @plust/datasleuth is with the default pipeline:

```typescript
import { research } from '@plust/datasleuth';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

// Define your output schema
const outputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  sources: z.array(z.string().url()),
});

// Execute research with default pipeline
const results = await research({
  query: 'Latest advancements in quantum computing',
  outputSchema,
  defaultLLM: openai('gpt-4o'),
});
```

### Advanced Research

For more control, configure a custom pipeline with specific steps:

```typescript
import {
  research,
  plan,
  searchWeb,
  extractContent,
  evaluate,
  repeatUntil,
} from '@plust/datasleuth';
import { z } from 'zod';
import { google } from '@plust/search-sdk';
import { openai } from '@ai-sdk/openai';

// Configure a search provider
const googleSearch = google.configure({
  apiKey: process.env.GOOGLE_API_KEY,
  cx: process.env.GOOGLE_CX,
});

// Define complex output schema
const outputSchema = z.object({
  summary: z.string(),
  threats: z.array(z.string()),
  opportunities: z.array(z.string()),
  timeline: z.array(
    z.object({
      year: z.number(),
      event: z.string(),
    })
  ),
  sources: z.array(
    z.object({
      url: z.string().url(),
      reliability: z.number().min(0).max(1),
    })
  ),
});

// Execute research with custom pipeline steps
const results = await research({
  query: 'Impact of climate change on agriculture',
  outputSchema,
  steps: [
    plan({ llm: openai('gpt-4o') }),
    searchWeb({ provider: googleSearch, maxResults: 10 }),
    extractContent({ selector: 'article, .content, main' }),
    repeatUntil(evaluate({ criteriaFn: (data) => data.sources.length > 15 }), [
      searchWeb({ provider: googleSearch }),
      extractContent(),
    ]),
  ],
  config: {
    errorHandling: 'continue',
    timeout: 60000, // 1 minute
  },
});
```

### LLM Integration with Vercel AI SDK

@plust/datasleuth seamlessly integrates with the Vercel AI SDK, allowing you to
use any supported LLM provider:

```typescript
import {
  research,
  plan,
  analyze,
  factCheck,
  summarize,
} from '@plust/datasleuth';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Define your output schema
const outputSchema = z.object({
  summary: z.string(),
  analysis: z.object({
    insights: z.array(z.string()),
  }),
  factChecks: z.array(
    z.object({
      statement: z.string(),
      isValid: z.boolean(),
    })
  ),
});

// Use different LLM providers for different steps
const results = await research({
  query: 'Advancements in gene editing technologies',
  outputSchema,
  steps: [
    // Use OpenAI for research planning
    plan({
      llm: openai('gpt-4o'),
      temperature: 0.4,
    }),

    // Use Anthropic for specialized analysis
    analyze({
      llm: anthropic('claude-3-opus-20240229'),
      focus: 'ethical-considerations',
      depth: 'comprehensive',
    }),

    // Use OpenAI for fact checking
    factCheck({
      llm: openai('gpt-4o'),
      threshold: 0.8,
      includeEvidence: true,
    }),

    // Use Anthropic for final summarization
    summarize({
      llm: anthropic('claude-3-sonnet-20240229'),
      format: 'structured',
      maxLength: 2000,
    }),
  ],
});
```

### Parallel Research

Run multiple research tracks concurrently and merge the results:

```typescript
import {
  research,
  track,
  parallel,
  searchWeb,
  extractContent,
  analyze,
  ResultMerger,
} from '@plust/datasleuth';
import { z } from 'zod';
import { google, bing } from '@plust/search-sdk';
import { openai } from '@ai-sdk/openai';

// Configure search providers
const googleSearch = google.configure({ apiKey: process.env.GOOGLE_API_KEY });
const bingSearch = bing.configure({ apiKey: process.env.BING_API_KEY });

// Define your output schema
const outputSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      topic: z.string(),
      details: z.string(),
      confidence: z.number(),
    })
  ),
  sources: z.array(z.string().url()),
});

// Execute parallel research tracks
const results = await research({
  query: 'Quantum computing applications in healthcare',
  outputSchema,
  steps: [
    parallel({
      tracks: [
        track({
          name: 'academic',
          steps: [
            searchWeb({
              provider: googleSearch,
              query: 'quantum computing healthcare scholarly articles',
            }),
            extractContent(),
            analyze({
              llm: openai('gpt-4o'),
              focus: 'academic-research',
            }),
          ],
        }),
        track({
          name: 'commercial',
          steps: [
            searchWeb({
              provider: bingSearch,
              query: 'quantum computing healthcare startups companies',
            }),
            extractContent(),
            analyze({
              llm: openai('gpt-4o'),
              focus: 'commercial-applications',
            }),
          ],
        }),
      ],
      mergeFunction: ResultMerger.createMergeFunction({
        strategy: 'weighted',
        weights: { academic: 1.5, commercial: 1.0 },
        conflictResolution: 'mostConfident',
      }),
    }),
    summarize({ maxLength: 1000 }),
  ],
});
```

### Agent Orchestration

Use AI agents to dynamically decide which research steps to execute:

```typescript
import {
  research,
  orchestrate,
  searchWeb,
  extractContent,
  analyze,
  transform,
} from '@plust/datasleuth';
import { z } from 'zod';
import { google, serpapi } from '@plust/search-sdk';
import { openai } from '@ai-sdk/openai';

// Configure search providers
const webSearch = google.configure({ apiKey: process.env.GOOGLE_API_KEY });
const academicSearch = serpapi.configure({
  apiKey: process.env.SERPAPI_KEY,
  engine: 'google_scholar',
});

// Execute research with orchestration
const results = await research({
  query: 'Emerging technologies in renewable energy storage',
  outputSchema: z.object({
    marketOverview: z.string(),
    technologies: z.array(
      z.object({
        name: z.string(),
        maturityLevel: z.enum(['research', 'emerging', 'growth', 'mature']),
        costEfficiency: z.number().min(1).max(10),
        scalabilityPotential: z.number().min(1).max(10),
        keyPlayers: z.array(z.string()),
      })
    ),
    forecast: z.object({
      shortTerm: z.string(),
      mediumTerm: z.string(),
      longTerm: z.string(),
    }),
    sources: z.array(
      z.object({
        url: z.string().url(),
        type: z.enum(['academic', 'news', 'company', 'government']),
        relevance: z.number().min(0).max(1),
      })
    ),
  }),
  steps: [
    orchestrate({
      llm: openai('gpt-4o'),
      tools: {
        searchWeb: searchWeb({ provider: webSearch }),
        searchAcademic: searchWeb({ provider: academicSearch }),
        extractContent: extractContent(),
        analyze: analyze(),
        // Add your custom tools here
      },
      customPrompt: `
        You are conducting market research on emerging renewable energy storage technologies.
        Your goal is to build a comprehensive market overview with technical assessment.
      `,
      maxIterations: 15,
      exitCriteria: (state) =>
        state.metadata.confidenceScore > 0.85 &&
        state.data.dataPoints?.length > 20,
    }),
  ],
});
```

## API Reference

For complete API documentation, see the
[API Documentation](./docs/api/index.html).

### Core Functions

#### `research(options)`

The main research function that serves as the primary API.

```typescript
research({
  query: string;                // The research query
  outputSchema: z.ZodType<any>; // Schema defining the output structure
  steps?: ResearchStep[];       // Optional custom pipeline steps
  defaultLLM?: LanguageModel;   // Default LLM provider for AI-dependent steps
  config?: Partial<PipelineConfig>; // Optional configuration
}): Promise<unknown>
```

### Pipeline Steps

#### `plan(options?)`

Creates a research plan using LLMs.

```typescript
plan({
  llm?: LanguageModel;        // LLM model to use (falls back to defaultLLM)
  customPrompt?: string;      // Custom system prompt
  temperature?: number;       // LLM temperature (0.0-1.0)
  includeInResults?: boolean; // Whether to include plan in results
}): ResearchStep
```

#### `searchWeb(options)`

Searches the web using configured search providers.

```typescript
searchWeb({
  provider: SearchProvider;   // Configured search provider
  maxResults?: number;        // Maximum results to return
  language?: string;          // Language code (e.g., 'en')
  region?: string;            // Region code (e.g., 'US')
  safeSearch?: 'off' | 'moderate' | 'strict';
  useQueriesFromPlan?: boolean; // Use queries from research plan
}): ResearchStep
```

#### `extractContent(options?)`

Extracts content from web pages.

```typescript
extractContent({
  selectors?: string;         // CSS selectors for content
  maxUrls?: number;           // Maximum URLs to process
  maxContentLength?: number;  // Maximum content length per URL
  includeInResults?: boolean; // Whether to include content in results
}): ResearchStep
```

#### `factCheck(options?)`

Validates information using AI.

```typescript
factCheck({
  llm?: LanguageModel;        // LLM model to use
  threshold?: number;         // Confidence threshold (0.0-1.0)
  includeEvidence?: boolean;  // Include evidence in results
  detailedAnalysis?: boolean; // Perform detailed analysis
}): ResearchStep
```

#### `analyze(options?)`

Performs specialized analysis on collected data.

```typescript
analyze({
  llm?: LanguageModel;        // LLM model to use
  focus?: string;             // Analysis focus ('technical', 'business', etc.)
  depth?: 'basic' | 'comprehensive' | 'expert';
  includeInResults?: boolean; // Whether to include analysis in results
}): ResearchStep
```

#### `summarize(options?)`

Synthesizes information into concise summaries.

```typescript
summarize({
  llm?: LanguageModel;        // LLM model to use
  maxLength?: number;         // Maximum summary length
  format?: 'paragraph' | 'bullet' | 'structured';
  includeInResults?: boolean; // Whether to include summary in results
}): ResearchStep
```

#### `evaluate(options)`

Evaluates current state against specified criteria.

```typescript
evaluate({
  criteriaFn: (state) => boolean | Promise<boolean>; // Evaluation function
  criteriaName?: string;      // Name for this evaluation
  confidenceThreshold?: number; // Confidence threshold (0.0-1.0)
}): ResearchStep
```

#### `repeatUntil(conditionStep, stepsToRepeat, options?)`

Repeats steps until a condition is met.

```typescript
repeatUntil(
  conditionStep: ResearchStep,  // Step that evaluates condition
  stepsToRepeat: ResearchStep[], // Steps to repeat
  {
    maxIterations?: number;     // Maximum iterations
    throwOnMaxIterations?: boolean; // Throw error on max iterations
  }
): ResearchStep
```

#### `parallel(options)`

Executes multiple research tracks concurrently.

```typescript
parallel({
  tracks: TrackOptions[];      // Array of research tracks
  mergeFunction?: MergeFunction; // Function to merge results
  continueOnTrackError?: boolean; // Continue if a track fails
}): ResearchStep
```

#### `track(options)`

Creates an isolated research track.

```typescript
track({
  name: string;               // Track name
  steps: ResearchStep[];      // Steps to execute in this track
  initialData?: any;          // Initial data for this track
}): ResearchStep
```

#### `orchestrate(options)`

Uses AI agents to make dynamic decisions about research steps.

```typescript
orchestrate({
  llm: LanguageModel;         // LLM model for orchestration
  tools: Record<string, ResearchStep>; // Available tools for agent
  customPrompt?: string;      // Custom orchestration prompt
  maxIterations?: number;     // Maximum iterations
  exitCriteria?: (state) => boolean | Promise<boolean>; // Exit condition
}): ResearchStep
```

#### `transform(options?)`

Ensures research output matches the expected schema structure.

```typescript
transform({
  llm?: LanguageModel;           // LLM model to use (falls back to defaultLLM)
  allowMissingWithDefaults?: boolean; // Auto-fix missing fields with defaults
  useLLM?: boolean;              // Use LLM for intelligent transformation
  temperature?: number;          // LLM temperature (0.0-1.0)
  systemPrompt?: string;         // Custom system prompt
  transformFn?: (state) => any;  // Custom transformation function
}): ResearchStep
```

### Utilities

#### `ResultMerger`

Utilities for merging results from parallel research tracks.

```typescript
ResultMerger.createMergeFunction({
  strategy: 'mostConfident' | 'first' | 'last' | 'majority' | 'weighted' | 'custom';
  weights?: Record<string, number>; // For weighted strategy
  customMergeFn?: (results: any[]) => any; // For custom strategy
  conflictResolution?: 'mostConfident' | 'first' | 'last' | 'average';
});
```

## Error Handling

@plust/datasleuth provides detailed error types for different failure scenarios:

- `ConfigurationError`: Invalid configuration (missing required parameters,
  etc.)
- `ValidationError`: Output doesn't match the provided schema
- `LLMError`: Error communicating with language model
- `SearchError`: Error executing web searches
- `ContentExtractionError`: Error extracting content from web pages
- `TimeoutError`: Operation exceeded the configured timeout
- `PipelineError`: Error in pipeline execution

Each error includes:

- Descriptive message
- Detailed error information
- Suggestions for resolving the issue

Example handling errors:

```typescript
import { research, BaseResearchError } from '@plust/datasleuth';
import { z } from 'zod';

try {
  const results = await research({
    query: 'Quantum computing applications',
    outputSchema: z.object({
      /*...*/
    }),
  });
} catch (error) {
  if (error instanceof BaseResearchError) {
    console.error(`Research error: ${error.message}`);
    console.error(`Details: ${JSON.stringify(error.details)}`);
    console.error(`Suggestions: ${error.suggestions.join('\n')}`);
  } else {
    console.error(`Unexpected error: ${error}`);
  }
}
```

## Troubleshooting

For detailed troubleshooting information, see the
[Troubleshooting Guide](./docs/troubleshooting.md).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details on
how to contribute.

## License

MIT
