# @plust/datasleuth

A powerful deep research tool for gathering and synthesizing information with AI. This package enables developers to perform comprehensive research on any topic with a simple functional API, returning structured results based on a specified schema.

## Installation

```bash
npm install @plust/datasleuth
```

## Features

- 🔍 Comprehensive research capabilities with configurable pipeline steps
- 🤖 AI-powered research planning and orchestration
- 🌐 Web search integration with multiple providers
- 📊 Content extraction and analysis
- 🔄 Adaptive research strategies with feedback loops
- 📚 Structured output format with schema validation
- 🔧 Flexible and extensible architecture
- 🧠 Drop-in LLM integration with Vercel AI SDK

## Basic Usage

```typescript
import { research } from '@plust/datasleuth';
import { z } from 'zod';

// Define the structure of your research results
const outputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  sources: z.array(z.string().url())
});

// Execute research
const results = await research({
  query: "Latest advancements in quantum computing",
  outputSchema
});

console.log(results);
```

## Advanced Usage

```typescript
import { 
  research, 
  plan, 
  searchWeb, 
  extractContent, 
  evaluate, 
  repeatUntil 
} from '@plust/datasleuth';
import { z } from 'zod';
import { google } from '@plust/search-sdk';

// Configure a search provider
const googleSearch = google.configure({
  apiKey: process.env.GOOGLE_API_KEY,
  cx: process.env.GOOGLE_CX
});

// Define complex output schema
const outputSchema = z.object({
  summary: z.string(),
  threats: z.array(z.string()),
  opportunities: z.array(z.string()),
  timeline: z.array(z.object({
    year: z.number(),
    event: z.string()
  })),
  sources: z.array(z.object({
    url: z.string().url(),
    reliability: z.number().min(0).max(1)
  }))
});

// Execute research with custom pipeline steps
const results = await research({
  query: "Impact of climate change on agriculture",
  outputSchema,
  steps: [
    plan(),
    searchWeb({ provider: googleSearch, maxResults: 10 }),
    extractContent({ selector: 'article, .content, main' }),
    repeatUntil(
      evaluate({ criteriaFn: (data) => data.sources.length > 15 }),
      [
        searchWeb({ provider: googleSearch }),
        extractContent()
      ]
    )
  ],
  config: {
    errorHandling: 'continue',
    timeout: 60000 // 1 minute
  }
});
```

## LLM Integration with Vercel AI SDK

@plust/datasleuth seamlessly integrates with the Vercel AI SDK, allowing you to use any supported LLM as a drop-in component:

```typescript
import { research, plan, analyze, factCheck, summarize } from '@plust/datasleuth';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Define your output schema
const outputSchema = z.object({
  summary: z.string(),
  analysis: z.object({
    insights: z.array(z.string())
  }),
  factChecks: z.array(z.object({
    statement: z.string(),
    isValid: z.boolean()
  }))
});

// Use different LLM providers for different steps
const results = await research({
  query: "Advancements in gene editing technologies",
  outputSchema,
  steps: [
    // Use OpenAI for research planning
    plan({ 
      llm: openai('gpt-4o'),
      temperature: 0.4
    }),
    
    // Use Anthropic for specialized analysis
    analyze({
      llm: anthropic('claude-3-opus-20240229'),
      focus: 'ethical-considerations',
      depth: 'comprehensive'
    }),
    
    // Use OpenAI for fact checking
    factCheck({
      llm: openai('gpt-4o'),
      threshold: 0.8,
      includeEvidence: true
    }),
    
    // Use Anthropic for final summarization
    summarize({
      llm: anthropic('claude-3-sonnet-20240229'),
      format: 'structured',
      maxLength: 2000
    })
  ]
});
```

You can use any model provider supported by the Vercel AI SDK, including:
- OpenAI (`openai`)
- Anthropic (`anthropic`)
- Google (`google`)
- Mistral (`mistral`)
- Cohere (`cohere`)
- And more

## Orchestration

For more complex research needs, use the orchestration feature to dynamically decide which tools to use:

```typescript
import { 
  research, 
  orchestrate, 
  searchWeb, 
  extractContent 
} from '@plust/datasleuth';
import { z } from 'zod';
import { google, scholar } from '@plust/search-sdk';
import { openai } from 'ai';

// Configure search providers
const webSearch = google.configure({ apiKey: process.env.GOOGLE_API_KEY });
const academicSearch = scholar.configure({ apiKey: process.env.SCHOLAR_API_KEY });

// Execute research with orchestration
const results = await research({
  query: "Emerging technologies in renewable energy storage",
  outputSchema: z.object({
    marketOverview: z.string(),
    technologies: z.array(z.object({
      name: z.string(),
      maturityLevel: z.enum(['research', 'emerging', 'growth', 'mature']),
      costEfficiency: z.number().min(1).max(10),
      scalabilityPotential: z.number().min(1).max(10),
      keyPlayers: z.array(z.string())
    })),
    forecast: z.object({
      shortTerm: z.string(),
      mediumTerm: z.string(),
      longTerm: z.string()
    }),
    sources: z.array(z.object({
      url: z.string().url(),
      type: z.enum(['academic', 'news', 'company', 'government']),
      relevance: z.number().min(0).max(1)
    }))
  }),
  steps: [
    orchestrate({
      model: openai.chat({ model: 'gpt-4-turbo' }),
      tools: {
        searchWeb: searchWeb({ provider: webSearch }),
        searchAcademic: searchWeb({ provider: academicSearch }),
        extractContent: extractContent(),
        // Add your custom tools here
      },
      customPrompt: `
        You are conducting market research on emerging renewable energy storage technologies.
        Your goal is to build a comprehensive market overview with technical assessment.
      `,
      maxIterations: 15,
      exitCriteria: (state) => 
        state.confidenceScore > 0.85 && state.dataPoints.length > 20
    })
  ]
});
```

## API Reference

### Core Functions

#### `research(options)`

The main research function that serves as the primary API.

```typescript
research({
  query: string;                // The research query
  outputSchema: z.ZodType<any>; // Schema defining the output structure
  steps?: ResearchStep[];       // Optional custom pipeline steps
  config?: Partial<PipelineConfig>; // Optional configuration
}): Promise<unknown>
```

### Pipeline Steps

#### `plan(options?)`

Creates a research plan using LLMs.

```typescript
plan({
  customPrompt?: string;    // Custom system prompt
  model?: any;              // LLM model to use
  temperature?: number;     // LLM temperature (0.0-1.0)
  includeInResults?: boolean; // Whether to include plan in results
}): ResearchStep
```

#### `searchWeb(options)`

Searches the web using configured search providers.

```typescript
searchWeb({
  provider: any;            // Configured search provider
  maxResults?: number;      // Maximum results to return
  language?: string;        // Language code (e.g., 'en')
  region?: string;          // Region code (e.g., 'US')
  safeSearch?: 'off' | 'moderate' | 'strict';
  useQueriesFromPlan?: boolean; // Use queries from research plan
}): ResearchStep
```

#### `extractContent(options?)`

Extracts content from web pages.

```typescript
extractContent({
  selectors?: string;       // CSS selectors for content
  maxUrls?: number;         // Maximum URLs to process
  maxContentLength?: number; // Maximum content length per URL
  includeInResults?: boolean; // Whether to include content in results
}): ResearchStep
```

#### `evaluate(options)`

Evaluates current state against specified criteria.

```typescript
evaluate({
  criteriaFn: (state) => boolean | Promise<boolean>; // Evaluation function
  criteriaName?: string;    // Name for this evaluation
  confidenceThreshold?: number; // Confidence threshold (0.0-1.0)
}): ResearchStep
```

#### `repeatUntil(conditionStep, stepsToRepeat, options?)`

Repeats steps until a condition is met.

```typescript
repeatUntil(
  conditionStep: ResearchStep,         // Step that evaluates condition
  stepsToRepeat: ResearchStep[],       // Steps to repeat
  {
    maxIterations?: number;            // Maximum iterations
    throwOnMaxIterations?: boolean;    // Throw error on max iterations
  }
): ResearchStep
```

#### `orchestrate(options)`

Uses AI agents to make dynamic decisions about research steps.

```typescript
orchestrate({
  model: any;               // LLM model for orchestration
  tools: Record<string, ResearchStep>; // Available tools for agent
  customPrompt?: string;    // Custom orchestration prompt
  maxIterations?: number;   // Maximum iterations
  exitCriteria?: (state) => boolean | Promise<boolean>; // Exit condition
}): ResearchStep
```

## Examples

Check out the examples directory for complete examples of different research scenarios:

- `examples/basic-research.ts` - Basic research with default pipeline
- `examples/advanced-research.ts` - Advanced research with custom pipeline
- `examples/orchestration-research.ts` - Research using agent orchestration

## License

MIT