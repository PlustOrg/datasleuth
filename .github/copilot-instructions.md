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

## Implementation Planning

### 1. Project Structure Setup
1. Initialize project with `npm init -y` and set up TypeScript, ESLint, and Prettier
2. Create the following directory structure:
   ```
   /src
     /core       # Core functionality (research function, pipeline orchestration)
     /steps      # Individual pipeline steps (search, extract, evaluate, etc.)
     /tools      # Tool integrations (search providers, LLM connectors)
     /types      # TypeScript interfaces and type definitions
     /utils      # Helper functions and utilities
     /validators # Schema validation and output formatting
   /tests        # Unit and integration tests
   /examples     # Example implementations
   /docs         # Documentation
   ```
3. Set up package.json with appropriate scripts, package details and dependencies

### 2. Core Functionality Implementation
1. Create the main `research()` function that serves as the primary API
   - Implement pipeline execution engine that processes steps sequentially
   - Add validation for input query and output schema
   - Implement state management between pipeline steps
   
2. Create pipeline orchestration module
   - Implement step registration and execution
   - Add error handling and recovery mechanisms
   - Build logging and debugging utilities

### 3. Pipeline Steps Implementation
1. Research Planning
   - Implement `plan()` step that uses LLMs to create research strategy
   - Create structured research objectives generator

2. Data Acquisition
   - Implement `searchWeb()` with provider integration
   - Create `extractContent()` with HTML parsing and content extraction

3. Data Analysis
   - Implement `factCheck()`, `analyze()`, and `synthesize()` steps
   - Create specialized analysis modules for different data types

4. Flow Control
   - Implement `repeatUntil()` for conditional iteration
   - Create `evaluate()` for quality assessment
   - Build `refineQuery()` for adaptive search improvements

5. Orchestration
   - Implement `orchestrate()` for agent-based decision making
   - Create dynamic tool selection mechanism

### 4. Advanced Features Implementation
1. Multi-track Research
   - Implement `parallel()` and `track()` for concurrent research paths
   - Create result merging and conflict resolution

2. Adaptive Learning
   - Implement confidence scoring system
   - Create data gap identification mechanism
   - Build provider optimization based on task type

### 6. Documentation and Examples
1. Create comprehensive API documentation
2. Build example implementations for common use cases
3. Add detailed explanations for each pipeline step

## How It Works

The deep research tool uses a modular pipeline approach with configurable steps to:
- Plan research and establish objectives
- Search websites and extract important content
- Evaluate intermediate results and adjust strategies
- Refine queries based on found data
- Execute specialized domain-specific analysis
- Make pivoting decisions and iterate until quality thresholds are met

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
         synthesize, compareResults, decideNextStep } from '@plust/deep-restruct';
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
                compareSolutions: compareResults(),
                synthesizeFindings: synthesize()
            },
            // The orchestration agent decides which tools to use and in what order
            customPrompt: `
                You are conducting market research on emerging renewable energy storage technologies.
                Your goal is to build a comprehensive market overview with technical assessment.
            `,
            maxIterations: 15,
            exitCriteria: (state) => 
                state.confidenceScore > 0.85 && state.dataPoints.length > 20
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

### Advanced Features (Implementation Guide)

The package should support:

1. **Custom Tools Integration**
     - Allow custom tools via `mastra.createTool()`
     - Support for custom LLM providers through the `ai` SDK

2. **Pipeline Configuration**
     - Implement specialized research steps (search, analysis, fact-check, summarize)
     - Support dynamic research strategies with evaluation criteria
     - Allow phase-based research with configurable thresholds

3. **Multi-track Research**
     - Support parallel research tracks with `parallel()` and `track()`
     - Allow merging results from different tracks
     - Implement entity classification, clustering, and prioritization

4. **Adaptive Learning**
     - Support for multiple LLM providers optimized for different tasks
     - Implement confidence scoring and data gap identification
     - Support regional focus and specialized content extraction
