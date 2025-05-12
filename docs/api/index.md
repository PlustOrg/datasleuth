# @plust/datasleuth API Reference

This document provides detailed information about the @plust/datasleuth API, including all functions, parameters, and return types.

## Table of Contents

- [Core API](#core-api)
  - [research()](#research)
  - [configureResearch()](#configureresearch)
- [Research Steps](#research-steps)
  - [Basic Steps](#basic-steps)
    - [plan()](#plan)
    - [searchWeb()](#searchweb)
    - [extractContent()](#extractcontent)
  - [Analysis Steps](#analysis-steps)
    - [analyze()](#analyze)
    - [factCheck()](#factcheck)
    - [summarize()](#summarize)
    - [classify()](#classify)
  - [Flow Control Steps](#flow-control-steps)
    - [evaluate()](#evaluate)
    - [repeatUntil()](#repeatuntil)
  - [Advanced Steps](#advanced-steps)
    - [track()](#track)
    - [parallel()](#parallel)
    - [orchestrate()](#orchestrate)
    - [refineQuery()](#refinequery)
- [Utility Functions](#utility-functions)
  - [ResultMerger](#resultmerger)
  - [executeWithRetry](#executewithretry)
- [Types](#types)
  - [ResearchState](#researchstate)
  - [ResearchStep](#researchstep)
  - [PipelineConfig](#pipelineconfig)
  - [Error Types](#error-types)

## Core API

### research()

The main entry point for conducting research.

#### Signature

```typescript
function research<T>({
  query,
  outputSchema,
  steps,
  defaultLLM,
  config
}: ResearchOptions<T>): Promise<T>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | The research query or topic |
| `outputSchema` | `z.ZodType<T>` | Zod schema defining the structure of the output |
| `steps` | `ResearchStep[]` | Optional custom pipeline steps |
| `defaultLLM` | `LanguageModel` | Default language model to use for AI-dependent steps |
| `config` | `Partial<PipelineConfig>` | Optional configuration for the research pipeline |

#### Returns

`Promise<T>`: A promise that resolves to the research results matching the provided output schema.

#### Example

```typescript
import { research } from '@plust/datasleuth';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

const results = await research({
  query: "Latest advancements in quantum computing",
  outputSchema: z.object({
    summary: z.string(),
    keyFindings: z.array(z.string()),
    sources: z.array(z.string().url())
  }),
  defaultLLM: openai('gpt-4o')
});
```

### configureResearch()

Creates a pre-configured research function with default options.

#### Signature

```typescript
function configureResearch(defaultOptions: Partial<ResearchOptions<any>>): 
  <T>(options: Partial<ResearchOptions<T>> & { outputSchema: z.ZodType<T> }) => Promise<T>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `defaultOptions` | `Partial<ResearchOptions<any>>` | Default options to apply to all research calls |

#### Returns

A configured research function that applies the default options.

#### Example

```typescript
import { configureResearch } from '@plust/datasleuth';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { google } from '@plust/search-sdk';

const googleSearch = google.configure({
  apiKey: process.env.GOOGLE_API_KEY,
  cx: process.env.GOOGLE_CX
});

// Create a pre-configured research function
const myResearch = configureResearch({
  defaultLLM: openai('gpt-4o'),
  config: {
    logLevel: 'info',
    timeout: 60000
  },
  // Default steps to use for all research
  steps: [
    searchWeb({ provider: googleSearch, maxResults: 10 }),
    extractContent()
  ]
});

// Use the pre-configured function
const results = await myResearch({
  query: "Benefits of exercise",
  outputSchema: z.object({
    summary: z.string(),
    benefits: z.array(z.string())
  })
  // No need to specify steps, defaultLLM, or config again
});
```

## Research Steps

### Basic Steps

#### plan()

Creates a research plan with AI to guide the research process.

#### Signature

```typescript
function plan(options?: PlanOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.llm` | `LanguageModel` | LLM to use for planning (falls back to defaultLLM) |
| `options.customPrompt` | `string` | Custom system prompt for planning |
| `options.temperature` | `number` | LLM temperature (0.0-1.0) |
| `options.includeInResults` | `boolean` | Whether to include plan in results |

#### Example

```typescript
import { research, plan } from '@plust/datasleuth';
import { openai } from '@ai-sdk/openai';

const results = await research({
  query: "Impact of climate change on biodiversity",
  steps: [
    plan({
      llm: openai('gpt-4o'),
      temperature: 0.7,
      customPrompt: "Create a detailed research plan focusing on ecosystem impacts."
    }),
    // Other steps...
  ],
  outputSchema: schema
});
```

#### searchWeb()

Performs web searches using configured search providers.

#### Signature

```typescript
function searchWeb(options: SearchWebOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.provider` | `SearchProvider` | Configured search provider |
| `options.query` | `string` | Optional override for the search query |
| `options.maxResults` | `number` | Maximum results to return (default: 5) |
| `options.language` | `string` | Language code (e.g., 'en') |
| `options.region` | `string` | Region code (e.g., 'US') |
| `options.safeSearch` | `'off' \| 'moderate' \| 'strict'` | Content filtering level |
| `options.useQueriesFromPlan` | `boolean` | Use queries from research plan |

#### Example

```typescript
import { research, searchWeb } from '@plust/datasleuth';
import { google } from '@plust/search-sdk';

const googleSearch = google.configure({
  apiKey: process.env.GOOGLE_API_KEY,
  cx: process.env.GOOGLE_CX
});

const results = await research({
  query: "Renewable energy trends",
  steps: [
    searchWeb({
      provider: googleSearch,
      maxResults: 10,
      language: 'en',
      region: 'US',
      safeSearch: 'moderate'
    }),
    // Other steps...
  ],
  outputSchema: schema
});
```

#### extractContent()

Extracts content from web pages returned by search results.

#### Signature

```typescript
function extractContent(options?: ExtractContentOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.selectors` | `string` | CSS selectors for content extraction |
| `options.maxUrls` | `number` | Maximum URLs to process |
| `options.maxContentLength` | `number` | Maximum content length per URL |
| `options.includeInResults` | `boolean` | Whether to include extracted content in results |

#### Example

```typescript
import { research, searchWeb, extractContent } from '@plust/datasleuth';

const results = await research({
  query: "JavaScript promises tutorial",
  steps: [
    searchWeb({ provider: googleSearch }),
    extractContent({
      selectors: 'article, .content, main',
      maxUrls: 5,
      maxContentLength: 50000
    }),
    // Other steps...
  ],
  outputSchema: schema
});
```

### Analysis Steps

#### analyze()

Performs specialized analysis on collected data using AI.

#### Signature

```typescript
function analyze(options?: AnalyzeOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.llm` | `LanguageModel` | LLM to use for analysis |
| `options.focus` | `string` | Analysis focus ('technical', 'business', etc.) |
| `options.depth` | `'basic' \| 'comprehensive' \| 'expert'` | Depth of analysis |
| `options.includeInResults` | `boolean` | Whether to include analysis in results |

#### Example

```typescript
import { research, searchWeb, extractContent, analyze } from '@plust/datasleuth';
import { openai } from '@ai-sdk/openai';

const results = await research({
  query: "Blockchain applications in supply chain",
  steps: [
    searchWeb({ provider: searchProvider }),
    extractContent(),
    analyze({
      llm: openai('gpt-4o'),
      focus: 'business-applications',
      depth: 'comprehensive'
    }),
    // Other steps...
  ],
  outputSchema: schema
});
```

#### factCheck()

Validates information using AI to ensure accuracy.

#### Signature

```typescript
function factCheck(options?: FactCheckOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.llm` | `LanguageModel` | LLM to use for fact checking |
| `options.threshold` | `number` | Confidence threshold (0.0-1.0) |
| `options.includeEvidence` | `boolean` | Include evidence for fact checks |
| `options.detailedAnalysis` | `boolean` | Perform detailed analysis |

#### Example

```typescript
import { research, searchWeb, extractContent, factCheck } from '@plust/datasleuth';
import { openai } from '@ai-sdk/openai';

const results = await research({
  query: "COVID-19 vaccine efficacy",
  steps: [
    searchWeb({ provider: searchProvider }),
    extractContent(),
    factCheck({
      llm: openai('gpt-4o'),
      threshold: 0.8,
      includeEvidence: true,
      detailedAnalysis: true
    }),
    // Other steps...
  ],
  outputSchema: schema
});
```

#### summarize()

Synthesizes information into concise summaries.

#### Signature

```typescript
function summarize(options?: SummarizeOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.llm` | `LanguageModel` | LLM to use for summarization |
| `options.maxLength` | `number` | Maximum summary length |
| `options.format` | `'paragraph' \| 'bullet' \| 'structured'` | Summary format |
| `options.includeInResults` | `boolean` | Whether to include summary in results |

#### Example

```typescript
import { research, searchWeb, extractContent, summarize } from '@plust/datasleuth';
import { openai } from '@ai-sdk/openai';

const results = await research({
  query: "Space tourism current status",
  steps: [
    searchWeb({ provider: searchProvider }),
    extractContent(),
    summarize({
      llm: openai('gpt-4o'),
      maxLength: 1000,
      format: 'structured'
    })
  ],
  outputSchema: schema
});
```

#### classify()

Performs entity classification and clustering on research data.

#### Signature

```typescript
function classify(options?: ClassifyOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.llm` | `LanguageModel` | LLM to use for classification |
| `options.classifyEntities` | `boolean` | Whether to classify entities |
| `options.clusterSimilarEntities` | `boolean` | Whether to cluster similar entities |
| `options.customTaxonomy` | `Record<string, string[]>` | Custom taxonomy for classification |

#### Example

```typescript
import { research, searchWeb, extractContent, classify } from '@plust/datasleuth';
import { openai } from '@ai-sdk/openai';

const results = await research({
  query: "AI companies and technologies",
  steps: [
    searchWeb({ provider: searchProvider }),
    extractContent(),
    classify({
      llm: openai('gpt-4o'),
      classifyEntities: true,
      clusterSimilarEntities: true,
      customTaxonomy: {
        'companies': ['startup', 'enterprise', 'public', 'private'],
        'technologies': ['machine learning', 'computer vision', 'NLP', 'robotics']
      }
    })
  ],
  outputSchema: schema
});
```

### Flow Control Steps

#### evaluate()

Evaluates current state against specified criteria.

#### Signature

```typescript
function evaluate(options: EvaluateOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.criteriaFn` | `(state: ResearchState) => boolean \| Promise<boolean>` | Evaluation function |
| `options.criteriaName` | `string` | Name for this evaluation |
| `options.confidenceThreshold` | `number` | Confidence threshold (0.0-1.0) |

#### Example

```typescript
import { research, searchWeb, extractContent, evaluate, summarize } from '@plust/datasleuth';

const results = await research({
  query: "Electric vehicle market trends",
  steps: [
    searchWeb({ provider: searchProvider }),
    extractContent(),
    evaluate({
      criteriaName: 'sufficientSources',
      criteriaFn: (state) => {
        // Only continue if we have at least 5 sources
        return (state.data.sources?.length || 0) >= 5;
      }
    }),
    summarize()
  ],
  outputSchema: schema
});
```

#### repeatUntil()

Repeats steps until a condition is met.

#### Signature

```typescript
function repeatUntil(
  conditionStep: ResearchStep,
  stepsToRepeat: ResearchStep[],
  options?: RepeatUntilOptions
): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `conditionStep` | `ResearchStep` | Step that evaluates the condition |
| `stepsToRepeat` | `ResearchStep[]` | Steps to repeat until condition is met |
| `options.maxIterations` | `number` | Maximum iterations (default: 5) |
| `options.throwOnMaxIterations` | `boolean` | Whether to throw error on max iterations |

#### Example

```typescript
import { research, searchWeb, extractContent, evaluate, repeatUntil, refineQuery } from '@plust/datasleuth';

const results = await research({
  query: "Latest cancer treatment advances",
  steps: [
    searchWeb({ provider: searchProvider }),
    extractContent(),
    repeatUntil(
      // Condition: have at least 10 high-quality sources
      evaluate({
        criteriaFn: (state) => {
          const sources = state.data.sources || [];
          const highQualitySources = sources.filter(s => s.reliability > 0.7);
          return highQualitySources.length >= 10;
        }
      }),
      // Steps to repeat until condition is met
      [
        refineQuery({ basedOn: 'findings' }),
        searchWeb({ provider: searchProvider }),
        extractContent()
      ],
      { maxIterations: 3 }
    ),
    // Continue with other steps once condition is met
    summarize()
  ],
  outputSchema: schema
});
```

### Advanced Steps

#### track()

Creates an isolated research track for focused investigation.

#### Signature

```typescript
function track(options: TrackOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.name` | `string` | Track name |
| `options.steps` | `ResearchStep[]` | Steps to execute in this track |
| `options.initialData` | `any` | Initial data for this track |

#### Example

```typescript
import { research, track, searchWeb, extractContent, analyze } from '@plust/datasleuth';

const results = await research({
  query: "Green energy investment trends",
  steps: [
    track({
      name: 'solarTrends',
      steps: [
        searchWeb({ query: "solar energy investment trends" }),
        extractContent(),
        analyze({ focus: 'market-trends' })
      ]
    }),
    // Other steps or tracks...
  ],
  outputSchema: schema
});
```

#### parallel()

Executes multiple research tracks concurrently.

#### Signature

```typescript
function parallel(options: ParallelOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.tracks` | `TrackOptions[]` | Array of research tracks |
| `options.mergeFunction` | `MergeFunction` | Function to merge results |
| `options.continueOnTrackError` | `boolean` | Continue if a track fails |

#### Example

```typescript
import { research, parallel, track, searchWeb, extractContent, analyze, ResultMerger } from '@plust/datasleuth';

const results = await research({
  query: "Renewable energy comparison",
  steps: [
    parallel({
      tracks: [
        track({
          name: 'solar',
          steps: [
            searchWeb({ query: "solar energy efficiency cost" }),
            extractContent(),
            analyze({ focus: 'technical-economic' })
          ]
        }),
        track({
          name: 'wind',
          steps: [
            searchWeb({ query: "wind energy efficiency cost" }),
            extractContent(),
            analyze({ focus: 'technical-economic' })
          ]
        }),
        track({
          name: 'hydroelectric',
          steps: [
            searchWeb({ query: "hydroelectric energy efficiency cost" }),
            extractContent(),
            analyze({ focus: 'technical-economic' })
          ]
        })
      ],
      mergeFunction: ResultMerger.createMergeFunction({
        strategy: 'weighted',
        weights: { solar: 1.2, wind: 1.0, hydroelectric: 0.8 }
      }),
      continueOnTrackError: true
    }),
    summarize()
  ],
  outputSchema: schema
});
```

#### orchestrate()

Uses AI agents to make dynamic decisions about research steps.

#### Signature

```typescript
function orchestrate(options: OrchestrateOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.llm` | `LanguageModel` | LLM for orchestration |
| `options.tools` | `Record<string, ResearchStep>` | Available tools for agent |
| `options.customPrompt` | `string` | Custom orchestration prompt |
| `options.maxIterations` | `number` | Maximum iterations |
| `options.exitCriteria` | `(state) => boolean \| Promise<boolean>` | Exit condition |

#### Example

```typescript
import { research, orchestrate, searchWeb, extractContent, analyze, factCheck } from '@plust/datasleuth';
import { google } from '@plust/search-sdk';
import { openai } from '@ai-sdk/openai';

const googleSearch = google.configure({
  apiKey: process.env.GOOGLE_API_KEY,
  cx: process.env.GOOGLE_CX
});

const results = await research({
  query: "Future of transportation technology",
  steps: [
    orchestrate({
      llm: openai('gpt-4o'),
      tools: {
        searchWeb: searchWeb({ provider: googleSearch }),
        extractContent: extractContent(),
        analyze: analyze(),
        factCheck: factCheck()
      },
      customPrompt: `
        You are conducting a comprehensive analysis of transportation technology trends.
        Focus on electric vehicles, autonomous driving, hyperloop, and urban air mobility.
      `,
      maxIterations: 10,
      exitCriteria: (state) => 
        (state.metadata.completedIterations > 5) && 
        (state.metadata.confidenceScore > 0.8)
    })
  ],
  outputSchema: schema
});
```

#### refineQuery()

Improves search queries based on findings.

#### Signature

```typescript
function refineQuery(options?: RefineQueryOptions): ResearchStep
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.llm` | `LanguageModel` | LLM to use for query refinement |
| `options.basedOn` | `'findings' \| 'gaps' \| 'both'` | What to base refinement on |
| `options.maxQueries` | `number` | Maximum number of refined queries |
| `options.includeOriginal` | `boolean` | Whether to include original query |

#### Example

```typescript
import { research, searchWeb, extractContent, refineQuery } from '@plust/datasleuth';
import { openai } from '@ai-sdk/openai';

const results = await research({
  query: "Machine learning in healthcare",
  steps: [
    searchWeb({ provider: searchProvider }),
    extractContent(),
    refineQuery({
      llm: openai('gpt-4o'),
      basedOn: 'gaps',
      maxQueries: 3,
      includeOriginal: true
    }),
    searchWeb({ provider: searchProvider }),
    extractContent(),
    // Other steps...
  ],
  outputSchema: schema
});
```

## Utility Functions

### ResultMerger

Utilities for merging results from parallel research tracks.

#### Signature

```typescript
ResultMerger.createMergeFunction({
  strategy: 'mostConfident' | 'first' | 'last' | 'majority' | 'weighted' | 'custom';
  weights?: Record<string, number>; // For weighted strategy
  customMergeFn?: (results: any[]) => any; // For custom strategy
  conflictResolution?: 'mostConfident' | 'first' | 'last' | 'average';
});
```

#### Example

```typescript
import { ResultMerger } from '@plust/datasleuth';

const mergeFunction = ResultMerger.createMergeFunction({
  strategy: 'weighted',
  weights: {
    scientific: 2.0,
    news: 1.0,
    social: 0.5
  },
  conflictResolution: 'mostConfident'
});
```

### executeWithRetry

Executes an operation with configurable retry logic.

#### Signature

```typescript
function executeWithRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `operation` | `() => Promise<T>` | The operation to execute |
| `options.maxRetries` | `number` | Maximum retry attempts (default: 3) |
| `options.initialDelay` | `number` | Initial delay in ms (default: 1000) |
| `options.backoffFactor` | `number` | Exponential backoff factor (default: 2) |
| `options.retryCondition` | `(error: unknown) => boolean` | Custom condition for retry |

#### Example

```typescript
import { executeWithRetry } from '@plust/datasleuth/utils';

const result = await executeWithRetry(
  () => fetchDataFromAPI(url),
  {
    maxRetries: 5,
    initialDelay: 2000,
    backoffFactor: 1.5,
    retryCondition: (error) => error instanceof NetworkError || error.statusCode === 429
  }
);
```

## Types

### ResearchState

Represents the state of the research pipeline.

```typescript
interface ResearchState {
  /** The original query for the research */
  query: string;
  
  /** The current stage in the research pipeline */
  stage: string;
  
  /** The data collected during research */
  data: Record<string, any>;
  
  /** Metadata about the research process */
  metadata: Record<string, any>;
  
  /** Timestamps for performance tracking */
  timestamps: {
    start: number;
    [key: string]: number;
  };
}
```

### ResearchStep

Represents a single step in the research pipeline.

```typescript
interface ResearchStep {
  /** Unique name of the step */
  name: string;
  
  /** Function that executes the step */
  execute: (state: ResearchState, options?: any) => Promise<ResearchState>;
  
  /** Step-specific options */
  options?: Record<string, any>;
}
```

### PipelineConfig

Configuration options for the research pipeline.

```typescript
interface PipelineConfig {
  /** Logging level */
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  
  /** Timeout in milliseconds */
  timeout: number;
  
  /** Error handling strategy */
  errorHandling: 'throw' | 'continue';
  
  /** Whether to continue on step errors */
  continueOnError: boolean;
  
  /** Whether to include step metadata in results */
  includeMetadata: boolean;
  
  /** Whether to allow empty results */
  allowEmptyResults: boolean;
}
```

### Error Types

#### BaseResearchError

Base error class for all @plust/datasleuth errors.

```typescript
class BaseResearchError extends Error {
  /** Error code for programmatic handling */
  code: string;
  
  /** Detailed error information */
  details: Record<string, any>;
  
  /** Suggestions for resolving the issue */
  suggestions: string[];
}
```

#### Specific Error Types

- `ConfigurationError`: Invalid configuration (missing required parameters, etc.)
- `ValidationError`: Output doesn't match the provided schema
- `LLMError`: Error communicating with language model
- `SearchError`: Error executing web searches
- `ContentExtractionError`: Error extracting content from web pages
- `TimeoutError`: Operation exceeded the configured timeout
- `PipelineError`: Error in pipeline execution

For detailed error handling, see the [Troubleshooting Guide](../troubleshooting.md).
