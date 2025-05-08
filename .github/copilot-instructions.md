# @plust/deep-restruct Development Guide

## Instructions
Keep code clean, modular and extensible. Add emoji to each response to ensure context. Plan next steps after each response. Read `docs/project-overview.md` periodically.

## Goal
Build a deep research tool as an npm package. Users provide a search query and output schema, and receive structured research results.

## Project Requirements
- Node.js package (`npm install @plust/deep-restruct`)
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

### 🔄 In Progress
- Error handling improvements
- Enhanced error handling and logging

### ⏭️ Next Steps
- Documentation and testing

## How It Works
Uses modular pipeline with configurable steps to plan research, search web, extract content, evaluate results, refine queries, analyze data, run parallel tracks, and merge findings. Users interact through a simple `research()` API.

## Development Plan

Based on the current project status, here's the implementation plan:

### ✅ 1. Type System Improvements (Completed)
- Replaced all `any`/`unknown` type usages with proper type definitions
- Added stricter type checking for pipeline steps and their inputs/outputs
- Created more specific interfaces for different research data structures
- Added proper generics for schema validation in the research pipeline
- Created type guards for runtime type checking
- Implemented compatibility layers for external dependencies

### ✅ 2. LLM Integration (Completed)
- Implement real LLM integrations in plan.ts, analyze.ts, and other AI-dependent steps
- Create proper abstractions for different LLM providers using the Vercel AI SDK
- Add configurable LLM options (model, temperature, etc.) to relevant steps
- Create utility functions for consistent prompt construction
- Integrate with mastra for advanced AI agent capabilities

### 🔄 3. Error Handling Enhancements (In Progress)
- Create specialized error classes that implement ResearchError
- Implement consistent error handling patterns across all steps
- Add retry mechanisms for external API calls (search, LLM, etc.)
- Provide detailed error messages and suggestions for recovery
- Add proper logging at different verbosity levels

### 4. Testing Framework
- Create unit tests for individual steps
- Develop integration tests for the full pipeline
- Implement mock providers for testing
- Create test fixtures for common research scenarios

### 5. Documentation
- Enhance JSDoc comments throughout the codebase
- Create usage examples with real-world scenarios
- Add troubleshooting guides and best practices
- Document all available options and configurations

## Use-Case Examples

### Basic Research
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

### Advanced Research
```typescript
import { research, plan, searchWeb, extractContent, factCheck, 
         repeatUntil, evaluate, refineQuery, summarize } from '@plust/deep-restruct';
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
         classify, summarize, ResultMerger } from '@plust/deep-restruct';
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

## Vercel AI SDK Docs

Short example of using the AI SDK for reference:

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-4o'),
  system: 'You are a helpful assistant.',
  prompt: 'Explain quantum entanglement.',
});
console.log(text);
```