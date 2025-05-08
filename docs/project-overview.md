# Project Overview: @plust/deep-restruct

This document provides a concise overview of the @plust/deep-restruct project structure and implementation. It's designed for AI coding agents to quickly understand the project without prior knowledge.

## Project Purpose

@plust/deep-restruct is a TypeScript library that provides a powerful framework for deep research tasks using AI. It enables developers to perform comprehensive research on any topic with a simple functional API, returning structured results based on a specified schema.

## Architecture

The project uses a **pipeline-based architecture** where research is conducted through a series of configurable steps:

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

## Key Coding Patterns

The project employs several consistent coding patterns:

1. **Factory Function Pattern**: Each pipeline step is created through a factory function that accepts options and returns a standardized step object. For example:
   ```typescript
   export function plan(options: PlanOptions = {}): ReturnType<typeof createStep> {
     return createStep('Plan', executePlanStep, options);
   }
   ```

2. **Immutable State Transformation**: Each step takes the current state as input and returns a new state without modifying the original:
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

3. **Options Pattern**: Steps accept optional configuration objects with sensible defaults:
   ```typescript
   export interface SearchWebOptions {
     provider: any;
     maxResults?: number; // Optional with default in implementation
     language?: string;   // Optional with default in implementation
   }
   ```

4. **Composition Pattern**: Complex research flows are built by composing simpler steps:
   ```typescript
   const steps = [
     plan(),
     searchWeb(options),
     repeatUntil(evaluate(criteria), [refineQuery(), searchWeb()])
   ];
   ```

5. **Schema Validation**: Input/output validation with Zod:
   ```typescript
   const outputSchema = z.object({
     summary: z.string(),
     keyFindings: z.array(z.string())
   });
   ```

6. **Simulation First Development**: Core functionality is first implemented with simulations for easier testing and development, before integrating with real services:
   ```typescript
   // Simulate LLM call (will be replaced with real implementation)
   async function simulateAnalysis(content, query) {
     await new Promise(resolve => setTimeout(resolve, 800));
     return { /* simulated result */ };
   }
   ```

7. **Parallel Processing Pattern**: The library supports concurrent execution of research steps through the track and parallel mechanisms:
   ```typescript
   const results = await research({
     query: "Quantum computing applications",
     steps: [
       parallel({
         tracks: [
           track({ name: 'technical', steps: [/* technical research steps */] }),
           track({ name: 'business', steps: [/* business research steps */] })
         ],
         mergeFunction: ResultMerger.createMergeFunction({ strategy: 'mostConfident' })
       })
     ]
   });
   ```

8. **Conflict Resolution Pattern**: When multiple research tracks produce potentially conflicting information, strategies for resolution are applied:
   ```typescript
   ResultMerger.createMergeFunction({
     strategy: 'mostConfident', // or 'first', 'last', 'majority', 'weighted', 'custom'
     weights: { technical: 1.5, business: 1.0 } // For weighted strategy
   })
   ```

## Usage Pattern

1. Define an output schema using Zod
2. Call `research()` with a query and schema
3. Optionally configure custom steps for specialized research

Basic example:
```typescript
import { research } from '@plust/deep-restruct';
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

Advanced example:
```typescript
import { 
  research, 
  plan, 
  searchWeb, 
  extractContent, 
  evaluate, 
  repeatUntil 
} from '@plust/deep-restruct';

const results = await research({
  query: "Impact of climate change on agriculture",
  outputSchema: outputSchema,
  steps: [
    plan(),
    searchWeb({ provider: googleSearch, maxResults: 10 }),
    extractContent(),
    repeatUntil(
      evaluate({ criteriaFn: (data) => /* condition */ }),
      [
        searchWeb({ provider: googleSearch }),
        extractContent()
      ]
    )
  ]
});
```

Parallel research example:
```typescript
import { 
  research, 
  track, 
  parallel, 
  searchWeb, 
  extractContent,
  analyze, 
  ResultMerger 
} from '@plust/deep-restruct';

const results = await research({
  query: "Quantum computing advancements",
  outputSchema: outputSchema,
  steps: [
    parallel({
      tracks: [
        track({
          name: 'technical',
          steps: [
            searchWeb({ provider: googleSearch, query: "quantum computing technical advancements" }),
            extractContent(),
            analyze({ focus: 'technical-details' })
          ]
        }),
        track({
          name: 'business',
          steps: [
            searchWeb({ provider: braveSearch, query: "quantum computing business applications" }),
            extractContent(),
            analyze({ focus: 'market-trends' })
          ]
        })
      ],
      mergeFunction: ResultMerger.createMergeFunction({
        strategy: 'mostConfident',
        weights: { technical: 1.5, business: 1.0 }
      })
    }),
    classify({
      classifyEntities: true,
      clusterEntities: true
    }),
    summarize()
  ]
});
```

## Current Status

- Basic research pipeline is implemented
- Core steps (plan, search, extract, analyze, etc.) are functional
- Advanced features including parallel research and entity classification are implemented
- Result merging with conflict resolution strategies is available
- Examples demonstrate different usage patterns and scenarios
- Most implementations currently use simulations rather than real LLM calls
- Ready for integration with actual LLM providers

## Dependencies

- `zod`: Schema validation
- `mastra`: AI agent toolkit
- `@plust/search-sdk`: Web search functionality
- `ai`: LLM provider integration

## Next Development Areas

- Integrating with real LLM providers
- Enhancing error handling and resilience
- Adding comprehensive unit and integration tests
- Implementing specialized domain-specific analysis modules
- Creating better debugging and logging utilities