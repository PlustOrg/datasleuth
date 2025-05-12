# @plust/datasleuth Development Guide

## Instructions
Keep code clean, modular and extensible. Add emoji to each response to ensure context. Plan next steps after each response.

## Goal
Build a deep research tool as an npm package. Users provide a search query and output schema, and receive structured research results through a modular pipeline of configurable steps.

## Project Requirements
- Node.js package (`npm install @plust/datasleuth`)
- TypeScript with ESLint/Prettier
- Modular files with single responsibility
- Required packages: `mastra` (AI agents), `zod` (validation), `ai` SDK (LLM integration), `@plust/search-sdk` (web searches)
- Functional API with configurable pipeline steps
- Dynamic research planning and adaptive strategies

## Implementation Status

### ✅ Completed
- Project setup (TypeScript, directories, dependencies)
- Core functionality (`research()` API, pipeline execution, validation)
- Basic steps (plan, search, extraction, evaluation, orchestration)
- Advanced steps (fact-checking, analysis, query refinement, summarization)
- Examples (basic to comprehensive implementations)
- Advanced features (multi-track research, parallel execution, result merging)
- Type system improvements (proper interfaces, reduced any/unknown usage)
- Integration with real LLM services through Vercel AI SDK
- Error handling improvements
- Enhanced error handling and logging
- Comprehensive test suite (unit & integration tests)

### 🔄 In Progress
- Documentation

### ⏭️ Next Steps
- Package preparation for npm distribution

## Architecture

The project uses a **pipeline-based architecture**:

1. **Core API**: The `research()` function serves as the main entry point
2. **Pipeline Engine**: Executes steps sequentially with state management
3. **Research Steps**: Modular, composable functions for different research tasks
4. **Schema Validation**: Uses Zod for input/output validation

## Key Components

### Core 
- `research.ts`: Main API function and default pipeline configuration
- `pipeline.ts`: Pipeline execution engine with error handling and state management

### Research Steps
- `plan.ts`: Creates a research plan with objectives and search queries
- `searchWeb.ts`: Performs web searches using configured providers
- `extractContent.ts`: Extracts content from web pages
- `factCheck.ts`: Validates information using LLMs
- `analyze.ts`: Performs specialized analysis on collected data
- `refineQuery.ts`: Improves search queries based on findings
- `summarize.ts`: Synthesizes information into concise summaries
- `flowControl.ts`: Conditional logic (`evaluate`, `repeatUntil`)
- `orchestrate.ts`: Uses AI agents to make decisions about research steps
- `track.ts`: Creates isolated research tracks for focused investigations
- `parallel.ts`: Executes multiple tracks concurrently for efficiency
- `classify.ts`: Performs entity classification and clustering on research data

### Utils & Types
- `steps.ts`: Utilities for creating standardized pipeline steps
- `pipeline.ts` (types): Core interfaces for the research pipeline
- `merge.ts`: Utilities for merging results from parallel research tracks
- `retry.ts`: Utilities for retrying operations with configurable backoff
- `logging.ts`: Structured logging with configurable verbosity levels
- `errors.ts`: Error classes and handling utilities

## Key Coding Patterns

1. **Factory Function Pattern**: Steps created through factory functions that accept options and return standardized step objects
2. **Immutable State Transformation**: Steps take current state as input and return new state without modifying original
3. **Options Pattern**: Steps accept optional configuration objects with sensible defaults
4. **Composition Pattern**: Complex research flows built by composing simpler steps
5. **Schema Validation**: Input/output validation with Zod
6. **Robust Error Handling**: Standardized error classes with helpful error messages and recovery suggestions
7. **Retry Pattern**: Operations with external dependencies use configurable retry mechanisms
8. **Parallel Processing Pattern**: Support for concurrent execution via track and parallel mechanisms
9. **Conflict Resolution Pattern**: Strategies for resolving conflicting information from parallel tracks
10. **Test-Driven Development**: Comprehensive test coverage with mocking of external dependencies

## Use-Case Examples

### Basic Research
```typescript
import { research } from '@plust/datasleuth';
import { z } from 'zod';

const results = await research({
    query: "Latest advancements in quantum computing",
    outputSchema: z.object({
        summary: z.string(),
        keyFindings: z.array(z.string()),
        sources: z.array(z.string().url())
    })
});
```

### Advanced Research
```typescript
import { research, plan, searchWeb, extractContent, factCheck, 
         repeatUntil, evaluate, refineQuery, summarize } from '@plust/datasleuth';
import { z } from 'zod';
import { google } from '@plust/search-sdk';
import { openai } from '@ai-sdk/openai';


const googleSearch = google.configure({
    apiKey: process.env.GOOGLE_API_KEY,
    cx: process.env.GOOGLE_CX
});

const detailedResearch = await research({
    query: "Impact of climate change on agriculture",
    steps: [
        plan({ llm: openai('gpt-4o') }),
        searchWeb({ provider: googleSearch, maxResults: 10 }),
        extractContent({ selector: 'article, .content, main' }),
        factCheck({ threshold: 0.8 }),
        repeatUntil(
            evaluate({ criteriaFn: (data) => data.sources.length > 15 }),
            [refineQuery({ basedOn: 'findings' }), searchWeb(), extractContent()]
        ),
        summarize({ maxLength: 1000 })
    ],
    outputSchema: z.object({
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
    })
});
```

### Parallel Research
```typescript
import { research, track, parallel, searchWeb, extractContent, analyze, 
         classify, summarize, ResultMerger } from '@plust/datasleuth';
import { z } from 'zod';
import { google, bing } from '@plust/search-sdk';

const parallelResearch = await research({
    query: "Quantum computing in healthcare",
    steps: [
        parallel({
            tracks: [
                track({
                    name: 'technical',
                    steps: [
                        searchWeb({ provider: google.configure({/*...*/}), 
                                  query: "quantum computing technical healthcare" }),
                        extractContent(),
                        analyze({ focus: 'technical-details' })
                    ]
                }),
                track({
                    name: 'clinical',
                    steps: [/*...similar structure...*/]
                }),
                track({
                    name: 'business',
                    steps: [/*...similar structure...*/]
                })
            ],
            mergeFunction: ResultMerger.createMergeFunction({
                strategy: 'weighted', 
                weights: { technical: 1.5, clinical: 1.8, business: 1.0 },
                conflictResolution: 'mostConfident'
            })
        }),
        classify({ classifyEntities: true, clusterSimilarEntities: true }),
        summarize({ format: 'structured' })
    ],
    outputSchema: z.object({
        summary: z.string(),
        applications: z.array(z.object({/*...*/})),
        entities: z.array(z.object({/*...*/})),
        sources: z.array(z.object({/*...*/}))
    })
});
```

## Implementation Guide

### Advanced Features
- Custom tool integration with `mastra.createTool()`
- Pipeline configuration with specialized steps and strategies
- Multi-track research with conflict resolution (`first`, `last`, `majority`, `weighted`, etc.)
- Adaptive learning with confidence scoring and specialized extraction

## Design Principles
1. **Modularity**: Independent, composable steps
2. **Extensibility**: Support for custom steps/tools
3. **Transparency**: Traceable research process
4. **Resilience**: Graceful error handling
5. **Configurability**: Fine-tunable research
6. **Type Safety**: Proper typing and validation
7. **Testability**: Comprehensive test coverage with mocking

## TypeScript Best Practices
1. Import `mastra` correctly: `import * as mastra from 'mastra'`
2. Use wrapper function pattern for steps
3. Access metadata via `state.metadata[propertyName]`
4. Use `ResearchError` interface for error handling
5. Be consistent with property names (`selectors` not `selector`)
6. Explicitly type arrays: `[] as MyType[]`
7. Preserve state structure in complex operations
8. Create proper error classes implementing `ResearchError`
9. Add type annotations for callbacks
10. Handle `ResearchState` metadata properly
11. Check optional properties before access
12. Use type guards for dynamic data
13. Errors in `catch` blocks are auto-typed as `unknown`. Use type guards to get the actual type.
14. Test error conditions with proper mocking and type assertions

## Code Examples

### Factory Function Pattern
```typescript
export function plan(options: PlanOptions = {}): ReturnType<typeof createStep> {
  return createStep('Plan', executePlanStep, options);
}
```

### Immutable State Transformation
```typescript
function executeStep(state: ResearchState, options: StepOptions): Promise<ResearchState> {
  // Process the current state
  return {
    ...state,
    data: {
      ...state.data,
      newData: processedResult
    }
  };
}
```

### Retry Pattern
```typescript
const result = await executeWithRetry(
  () => searchProvider.search(query),
  {
    maxRetries: 3,
    initialDelay: 1000,
    backoffFactor: 2
  }
);
```

## Vercel AI SDK Example
```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-4o'),
  system: 'You are a helpful assistant.',
  prompt: 'Explain quantum entanglement.',
});
```