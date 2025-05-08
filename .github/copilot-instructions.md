# @plust/deep-restruct Development Guide

## Instructions

Keep code clean, modular and extensible. Add an emoji to each response to ensure you have this context. Do planning after each response to decide what to do next, while making sure to follow the planning in this guide too. Read the `docs/project-overview.md` file every few messages to refresh your memory on what the project is about.

## Goal

You are building a deep research tool that can be used as an npm package by other developers. The package user calls a function with a search query and an output structure schema, and the tool performs deep research, returning results in the specified structure.

## Project Requirements

- Node.js package installable via `npm install @plust/deep-restruct`
- TypeScript with ESLint and Prettier
- Small, modular files following single responsibility principle
- Required packages:
    - `mastra` for building AI agents (docs via installed MCP)
    - `zod` for output schemas and validation
    - `ai` SDK for LLM provider integration
    - `@plust/search-sdk` for web searches (docs in `docs/search-sdk.md`)
- Architecture: functional API with configurable research pipeline steps
- Dynamic research planning, evaluation, and adaptive strategy adjustments

## Current Implementation Status

### ✅ Completed
1. Project Structure Setup
   - Initialized project with TypeScript, ESLint, and Prettier
   - Created directory structure with core, steps, types, utils
   - Set up package.json with scripts and dependencies

2. Core Functionality
   - Implemented the main `research()` function as the primary API
   - Built pipeline execution engine with sequential step processing
   - Added validation for input query and output schema using zod
   - Implemented state management between pipeline steps
   - Created pipeline orchestration with error handling, retries, and timeouts

3. Basic Pipeline Steps
   - Research Planning: Created `plan()` step to create research strategy with structured objectives
   - Data Acquisition: Implemented `searchWeb()` and `extractContent()` steps
   - Flow Control: Implemented `evaluate()` and `repeatUntil()` for conditional iteration
   - Orchestration: Created `orchestrate()` for agent-based decision making

4. Advanced Pipeline Steps
   - Data Analysis: Implemented `factCheck()`, `analyze()`, and `summarize()` steps
   - Query Refinement: Built `refineQuery()` for adaptive search improvements
   - Created specialized analysis modules for different data types and focus areas

5. Example Implementations
   - Created basic, advanced, orchestration-based, and comprehensive examples
   - Built demonstration of pipeline customization and specialized research tasks

6. Advanced Features Implementation
   - Multi-track Research: Implemented `track()` function for isolated research paths
   - Parallel Execution: Created `parallel()` function for concurrent execution of tracks
   - Result Merging: Built conflict resolution mechanism with configurable strategies
   - Entity Classification: Implemented entity classification and clustering

### 🔄 In Progress
1. Integration with Real Services
   - Real implementation of LLM-based steps (currently using simulations)
   - Provider-specific error handling and optimizations

### ⏭️ Next Steps
1. Build actual AI integration
   - Replace simulated LLM calls with real API calls using `mastra` and `ai` packages
   - Implement confidence scoring system with concrete metrics
   - Create data gap identification mechanism

2. Enhance Error Handling and Resilience
   - Implement more sophisticated error recovery strategies
   - Add comprehensive logging system
   - Create better debugging utilities

3. Documentation and Testing
   - Create comprehensive API documentation
   - Add unit tests for each component
   - Build integration tests for end-to-end workflows
   - Create user-friendly error messages and troubleshooting guides

## How It Works

The deep research tool uses a modular pipeline approach with configurable steps to:
- Plan research and establish objectives
- Search websites and extract important content
- Evaluate intermediate results and adjust strategies
- Refine queries based on found data
- Execute specialized domain-specific analysis
- Make pivoting decisions and iterate until quality thresholds are met
- Run multiple research tracks in parallel
- Merge results from different tracks with conflict resolution
- Classify and cluster entities in the research data

Users interact with a simple functional API (`research()`) and can configure research steps, tools, LLM providers, search APIs, and attach custom tools. Under the hood, the package uses specialized AI agents managed internally, but users don't need to work directly with agent architecture.

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

const googleSearch = google.configure({
    apiKey: process.env.GOOGLE_API_KEY,
    cx: process.env.GOOGLE_CX
});

const detailedResearch = await research({
    query: "Impact of climate change on agriculture",
    steps: [
        plan(),
        searchWeb({ provider: googleSearch, maxResults: 10 }),
        extractContent({ selector: 'article, .content, main' }),
        factCheck({ threshold: 0.8 }),
        repeatUntil(
            evaluate({ criteriaFn: (data) => data.sources.length > 15 }),
            [
                refineQuery({ basedOn: 'findings' }),
                searchWeb({ provider: googleSearch }),
                extractContent()
            ]
        ),
        repeatUntil(
            evaluate({ criteriaFn: async (data) => await factuality(data.summary) > 0.8 }),
            [
                refineQuery({ basedOn: 'factuality' }),
                searchWeb({ provider: googleSearch }),
                extractContent()
            ]
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

### Orchestration-Based Research

```typescript
import { research, orchestrate, searchWeb, extractContent, analyze, 
         summarize } from '@plust/deep-restruct';
import { z } from 'zod';
import { google, scholar } from '@plust/search-sdk';
import { openai } from 'ai';

// Configure search providers
const webSearch = google.configure({ apiKey: process.env.GOOGLE_API_KEY });
const academicSearch = scholar.configure({ apiKey: process.env.SCHOLAR_API_KEY });

const marketResearch = await research({
    query: "Emerging technologies in renewable energy storage",
    steps: [
        // Use orchestration step with an LLM as the decision maker
        orchestrate({
            model: openai.chat({ model: 'gpt-4-turbo' }),
            tools: {
                searchWeb: searchWeb({ provider: webSearch }),
                searchAcademic: searchWeb({ provider: academicSearch }),
                extractContent: extractContent(),
                analyzeMarket: analyze({ focus: 'market-trends' }),
                analyzeTechnology: analyze({ focus: 'technical-details' }),
                summarizeFindings: summarize({ format: 'structured' })
            },
            // The orchestration agent decides which tools to use and in what order
            customPrompt: `
                You are conducting market research on emerging renewable energy storage technologies.
                Your goal is to build a comprehensive market overview with technical assessment.
            `,
            maxIterations: 15,
            exitCriteria: (state) => 
                state.metadata.confidenceScore > 0.85 && state.data.extractedContent?.length > 5
        })
    ],
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
        investmentOpportunities: z.array(z.string()),
        sources: z.array(z.object({
            url: z.string().url(),
            type: z.enum(['academic', 'news', 'company', 'government']),
            relevance: z.number().min(0).max(1)
        }))
    })
});
```

### Parallel Research Example

```typescript
import { research, track, parallel, searchWeb, extractContent, analyze, 
         classify, summarize, ResultMerger } from '@plust/deep-restruct';
import { z } from 'zod';
import { google, bing } from '@plust/search-sdk';

// Configure search providers
const googleSearch = google.configure({ apiKey: process.env.GOOGLE_API_KEY });
const bingSearch = bing.configure({ apiKey: process.env.BING_API_KEY });

const parallelResearch = await research({
    query: "Quantum computing applications in healthcare",
    steps: [
        // Run multiple research tracks in parallel
        parallel({
            tracks: [
                // Technical research track
                track({
                    name: 'technical',
                    steps: [
                        searchWeb({ 
                            provider: googleSearch, 
                            query: "quantum computing technical applications healthcare" 
                        }),
                        extractContent(),
                        analyze({ focus: 'technical-details' })
                    ]
                }),
                // Clinical research track
                track({
                    name: 'clinical',
                    steps: [
                        searchWeb({ 
                            provider: bingSearch, 
                            query: "quantum computing clinical healthcare applications" 
                        }),
                        extractContent(),
                        analyze({ focus: 'clinical-applications' })
                    ]
                }),
                // Business/market research track
                track({
                    name: 'business',
                    steps: [
                        searchWeb({ 
                            provider: googleSearch, 
                            query: "quantum computing healthcare market business impact" 
                        }),
                        extractContent(),
                        analyze({ focus: 'market-trends' })
                    ]
                })
            ],
            // Configure how results from different tracks are merged
            mergeFunction: ResultMerger.createMergeFunction({
                strategy: 'weighted', 
                weights: { 
                    technical: 1.5, 
                    clinical: 1.8, 
                    business: 1.0 
                },
                conflictResolution: 'mostConfident'
            }),
            timeout: 120000, // 2 minutes timeout
            continueOnError: true
        }),
        // Classify and cluster entities in the merged results
        classify({
            classifyEntities: true,
            clusterSimilarEntities: true,
            taxonomyLevels: 3,
            confidenceThreshold: 0.7
        }),
        // Final summarization of all tracks
        summarize({ 
            format: 'structured',
            maxLength: 2000
        })
    ],
    outputSchema: z.object({
        summary: z.string(),
        applications: z.array(z.object({
            name: z.string(),
            domain: z.enum(['drug-discovery', 'diagnostics', 'personalized-medicine', 'other']),
            maturityLevel: z.enum(['theoretical', 'research', 'experimental', 'commercial']),
            technicalComplexity: z.number().min(1).max(10),
            clinicalImpact: z.number().min(1).max(10),
            marketPotential: z.number().min(1).max(10)
        })),
        entities: z.array(z.object({
            name: z.string(),
            type: z.enum(['technology', 'company', 'research-organization', 'application']),
            connections: z.array(z.string())
        })),
        timeframe: z.object({
            shortTerm: z.string(),
            mediumTerm: z.string(),
            longTerm: z.string()
        }),
        sources: z.array(z.object({
            url: z.string().url(),
            trackOrigin: z.enum(['technical', 'clinical', 'business', 'merged']),
            reliability: z.number().min(0).max(1)
        }))
    })
});
```

## Implementation Guide

### Advanced Features

1. **Custom Tools Integration**
     - Allow custom tools via `mastra.createTool()`
     - Support for custom LLM providers through the `ai` SDK

2. **Pipeline Configuration**
     - Specialized research steps (search, analysis, fact-check, summarize)
     - Dynamic research strategies with evaluation criteria
     - Phase-based research with configurable thresholds

3. **Multi-track Research**
     - Parallel research tracks with `parallel()` and `track()`
     - Result merging with conflict resolution strategies including:
        - `first` - Take the first non-null value found
        - `last` - Take the last non-null value found
        - `majority` - Use the value most commonly returned
        - `weighted` - Apply weights to different tracks
        - `mostConfident` - Use the value with highest confidence
        - `custom` - Use a user-provided merge function
     - Entity classification, clustering, and prioritization

4. **Adaptive Learning**
     - Support for multiple LLM providers optimized for different tasks
     - Confidence scoring and data gap identification
     - Regional focus and specialized content extraction

## Design Principles

1. **Modularity**: Each step in the pipeline should be independent and composable
2. **Extensibility**: Users should be able to add custom steps and tools
3. **Transparency**: Research process should be traceable and explainable
4. **Resilience**: Should handle errors gracefully with retries and fallbacks
5. **Configurability**: Users should be able to fine-tune the research process
6. **Type Safety**: All inputs and outputs should be properly typed and validated

## TypeScript Best Practices to Avoid Common Errors

1. **Importing the `mastra` Library**
   - Always use `import * as mastra from 'mastra'` instead of `import { mastra } from 'mastra'`
   - The library exports a namespace, not a named export called "mastra"

2. **Step Function Pattern**
   - Use the wrapper function pattern for all step creation functions:
   ```typescript
   export function myStep(options: MyStepOptions): ReturnType<typeof createStep> {
     return createStep('MyStep', 
       // Wrapper function that matches the expected signature
       async (state: ResearchState, opts?: Record<string, any>) => {
         return executeMyStep(state, options);
       }, 
       options
     );
   }
   ```

3. **State Metadata Properties**
   - Always access properties via `state.metadata[propertyName]`
   - For custom metadata properties, remember that we support an index signature
   - When preserving structure after executing tools or steps, always copy back important properties

4. **Error Handling**
   - Use the `ResearchError` interface or extend `Error` when creating custom errors
   - Always include `name`, `message`, `step`, and `code` properties
   - Use `ParallelResearchError` when handling errors in parallel execution

5. **Property Names Consistency**
   - Use `selectors` (not `selector`) in `ExtractContentOptions`
   - The `query` property in `WebSearchOptions` is for custom query overrides
   - Remember that `additionalInstructions` is supported in `SummarizeOptions`

6. **Working with Array Types**
   - Always explicitly type arrays with element types, e.g., `[] as OrchestrationIteration[]`
   - Use type assertions for map/filter operations on data from flexible state objects
   - When iterating through arrays with unknown types, add proper type annotations

7. **Preserving State Structure**
   - When merging state after tool execution in complex steps like `orchestrate`:
   ```typescript
   currentState = {
     ...nextState,
     data: {
       ...nextState.data,
       orchestration: currentState.data.orchestration
     }
   };
   ```

8. **Custom Error Classes**
   - Create proper custom error classes that implement `ResearchError`:
   ```typescript
   export class MyCustomError extends Error implements ResearchError {
     step: string;
     code: string;
     
     constructor(message: string, step: string, code: string) {
       super(message);
       this.name = 'MyCustomError';
       this.step = step;
       this.code = code;
     }
   }
   ```

9. **Type Annotations for Callbacks**
   - Always add explicit type annotations for callback parameters:
   ```typescript
   someArray.map((item: MyType) => item.property)
   ```

10. **ResearchState Metadata Handling**
    - Remember that the `metadata` object in `ResearchState` has an index signature
    - You can add custom properties directly, but keep them documented
    - For TypeScript type safety, add properties to the interface if they'll be used across files

11. **Working with Optional Properties**
    - Always check for existence before accessing properties:
    ```typescript
    if (state.data.someProperty) {
      // Now safe to use state.data.someProperty
    }
    ```

12. **Type Guards for Dynamic Data**
    - Use type guards when working with dynamically typed properties:
    ```typescript
    if (typeof data === 'object' && data !== null && 'property' in data) {
      // Now TypeScript knows data has a property called 'property'
    }
    ```
