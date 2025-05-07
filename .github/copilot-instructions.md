## Goal

You are building a deep research tool that can be used as an npm package by other developers. The idea is that the package user calls a function with a search query and an output structure schema, and the tool then performs deep research on the query, giving its output back to the user in the structure specified by the schema.

## Project structure

The idea of the deep research tool is to be highly extensible and modular, both to the end-user of the npm package, and in the project itself.

- The project must be structured as a Node.js package that can be easily installed with `npm install @plust/deep-restruct`. 
- It must be written in TypeScript, using ESLint and Prettier for linting and formatting.
- Files must maintain the single responsibility principle, and be kept small.
- The external `mastra` package must be installed and used to build the AI agents. The documentation for this `mastra` package is provided via an installed MCP.
- The `zod` package should be used for defining output schemas and validation.
- The `ai` SDK should be used for integrating with various LLM providers.
- The `@plust/search-sdk` package should be used for all web search operations. Its documentation is available in `docs/search-sdk.md`.
- Ensure the code is clean, files are small and modular, and that the most up-to-date libraries and documentation is used.

## How it works

At its core, the deep research tool consists of a bunch of AI agents, each being orchestrated by a main orchestrator AI agent to do things like:

- Planning the research steps.
- Searching for websites using textual queries.
- Getting the content of those websites and extracting what is important using things like NLP and other techniques.
- Refining search queries using found data.
- Iterating the process.

The end-user of the npm package should be able to configure the deep research tool to how they want it to work, what steps they want it to take and which tools, LLM providers and search APIs they want it to use. They should be able to attach their own agent tools to the process using the `mastra` package.

## Use-case examples

Here are some examples of how an end-user would use the package:

### Basic research with Zod schema

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

### Advanced research with custom pipeline and complex schema

```typescript
import { research, plan, searchWeb, extractContent, factCheck, repeatUntil, evaluate, refineQuery, summarize } from '@plust/deep-restruct';
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

### Using custom tools with mastra integration and AI SDK

```typescript
import { research, plan, summarize } from '@plust/deep-restruct';
import { createTool } from 'mastra';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@plust/search-sdk';
import { z } from 'zod';

const googleSearch = google.configure({
    apiKey: process.env.GOOGLE_API_KEY,
    cx: process.env.GOOGLE_CX
});

const weatherDataTool = createTool({
    name: 'weather-data',
    description: 'Fetches historical weather data for a region',
    execute: async (params) => {
        // Custom implementation
        return { /* weather data */ };
    }
});

const climateReportSchema = z.object({
    patterns: z.array(z.string()),
    timeline: z.array(z.object({
        decade: z.string(),
        trend: z.string()
    })),
    prediction: z.string()
});

const climateReport = await research({
    query: "Drought patterns in California 1950-2023",
    tools: [weatherDataTool],
    llmProvider: async (prompt, system) => {
        const { text } = await generateText({
            model: openai('gpt-4o'),
            system: system || 'You are a research assistant',
            prompt: prompt,
        });
        return text;
    },
    steps: [
        plan({ detailLevel: 'high' }),
        (ctx) => ctx.useTool('weather-data', { region: 'California', timespan: '1950-2023' }),
        searchWeb({ provider: googleSearch }),
        summarize()
    ],
    outputSchema: climateReportSchema
});

// Type inference works automatically
type ClimateReport = z.infer<typeof climateReportSchema>;
```

### Complex multi-track market research pipeline with adaptive learning

```typescript
import { research, parallel, track, mergeResults, plan, searchWeb, extractContent, factCheck, 
         classifyEntities, summarize, evaluate, cluster, prioritize, repeatUntil, refineQuery } from '@plust/deep-restruct';
import { brave, exa, tavily, serpapi } from '@plust/search-sdk';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { cohere } from '@ai-sdk/cohere';
import { z } from 'zod';

// Configure multiple search providers
const braveSearch = brave.configure({ apiKey: process.env.BRAVE_API_KEY });
const exaSearch = exa.configure({ apiKey: process.env.EXA_API_KEY, includeContents: true });
const tavilySearch = tavily.configure({ apiKey: process.env.TAVILY_API_KEY, searchDepth: 'comprehensive' });
const serpapiSearch = serpapi.configure({ apiKey: process.env.SERPAPI_KEY });

// Define our comprehensive market analysis schema
const marketAnalysisSchema = z.object({
    productOverview: z.object({
        name: z.string(),
        category: z.string(),
        keyFeatures: z.array(z.string()),
        targetAudience: z.array(z.string())
    }),
    marketLandscape: z.object({
        marketSize: z.string(),
        growthRate: z.number(),
        trends: z.array(z.string()),
        forecasts: z.array(z.object({
            year: z.number(),
            prediction: z.string(),
            confidence: z.number().min(0).max(1)
        }))
    }),
    competitiveAnalysis: z.object({
        directCompetitors: z.array(z.object({
            name: z.string(),
            strengths: z.array(z.string()),
            weaknesses: z.array(z.string()),
            marketShare: z.number().optional()
        })),
        indirectCompetitors: z.array(z.object({
            name: z.string(),
            relevance: z.string(),
            threat: z.enum(['low', 'medium', 'high'])
        }))
    }),
    consumerSentiment: z.object({
        overallRating: z.number().min(0).max(10),
        keyPraises: z.array(z.string()),
        commonComplaints: z.array(z.string()),
        sentimentTrend: z.string()
    }),
    regulatoryEnvironment: z.array(z.object({
        region: z.string(),
        regulations: z.array(z.string()),
        impact: z.enum(['positive', 'negative', 'neutral'])
    })),
    swotAnalysis: z.object({
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
        opportunities: z.array(z.string()),
        threats: z.array(z.string())
    }),
    sources: z.array(z.object({
        url: z.string().url(),
        title: z.string(),
        publishDate: z.string().optional(),
        credibilityScore: z.number().min(0).max(1),
        category: z.enum(['academic', 'news', 'industry', 'social', 'review', 'company'])
    })),
    researchQuality: z.object({
        confidenceScore: z.number().min(0).max(1),
        dataGaps: z.array(z.string()).optional(),
        dataConsistency: z.number().min(0).max(1)
    })
});

// Execute the complex research
const marketAnalysis = await research({
    query: "Electric vehicle market analysis for compact SUVs in North America 2023-2030",
    // Use multiple LLM providers optimized for different tasks
    llmProviders: {
        planning: async (prompt, system) => {
            const { text } = await generateText({
                model: openai('gpt-4o'),
                system: system || 'You are a strategic planning assistant',
                prompt: prompt,
            });
            return text;
        },
        analysis: async (prompt, system) => {
            const { text } = await generateText({
                model: anthropic('claude-3-opus'),
                system: system || 'You are a detailed analysis assistant',
                prompt: prompt,
            });
            return text;
        },
        summarization: async (prompt, system) => {
            const { text } = await generateText({
                model: cohere('command-r'),
                system: system || 'You are a summarization specialist',
                prompt: prompt,
            });
            return text;
        }
    },
    steps: [
        // Initial planning and query expansion
        plan({ detailLevel: 'comprehensive', useLLM: 'planning' }),
        parallel([
            // Track 1: Market overview track
            track('marketOverview', [
                searchWeb({ 
                    provider: tavilySearch, 
                    query: ctx => `${ctx.query} market size statistics trends forecast`, 
                    maxResults: 15 
                }),
                extractContent({ fullText: true }),
                factCheck({ threshold: 0.85, useLLM: 'analysis' }),
                classifyEntities({ types: ['market_stat', 'forecast', 'trend'], useLLM: 'analysis' }),
                summarize({ section: 'marketLandscape', useLLM: 'summarization' })
            ]),
            
            // Track 2: Competitor analysis track
            track('competitors', [
                searchWeb({ 
                    provider: braveSearch, 
                    query: ctx => `${ctx.query} competitors comparison`,
                    maxResults: 10
                }),
                extractContent(),
                // Get deeper info on each competitor
                repeatUntil(
                    evaluate({ criteriaFn: data => data.competitors.length >= 5 }),
                    [
                        refineQuery({ basedOn: 'competitors', template: '{{competitor}} market share strengths weaknesses' }),
                        searchWeb({ provider: exaSearch, maxResults: 5 }),
                        extractContent()
                    ]
                ),
                classifyEntities({ types: ['company', 'product'], useLLM: 'analysis' }),
                summarize({ section: 'competitiveAnalysis', useLLM: 'summarization' })
            ]),
            
            // Track 3: Consumer sentiment analysis
            track('sentiment', [
                searchWeb({ 
                    provider: serpapiSearch, 
                    query: ctx => `${ctx.query} customer reviews ratings`, 
                    maxResults: 8 
                }),
                extractContent({ selector: '.review, .comment, .rating, [itemprop="review"]' }),
                cluster({ 
                    method: 'sentiment', 
                    categories: ['positive', 'negative', 'neutral'],
                    useLLM: 'analysis'
                }),
                summarize({ section: 'consumerSentiment', useLLM: 'summarization' })
            ]),
            
            // Track 4: Regulatory environment analysis
            track('regulations', [
                searchWeb({ 
                    provider: tavilySearch, 
                    query: ctx => `${ctx.query} regulations policy incentives law`, 
                    maxResults: 12,
                    regionalFocus: ['US', 'Canada', 'Mexico'] 
                }),
                extractContent(),
                classifyEntities({ types: ['regulation', 'policy', 'incentive'], useLLM: 'analysis' }),
                cluster({ 
                    method: 'region', 
                    categories: ['US', 'Canada', 'Mexico', 'North America'], 
                    useLLM: 'analysis'
                }),
                summarize({ section: 'regulatoryEnvironment', useLLM: 'summarization' })
            ])
        ]),
        
        // Merge all tracks and perform holistic analysis
        mergeResults(),
        
        // Perform SWOT analysis based on all collected data
        (ctx) => ctx.runLLM({
            provider: 'analysis',
            task: 'Generate SWOT analysis based on all collected data',
            output: 'swotAnalysis'
        }),
        
        // Quality check the research with fact validation
        factCheck({ 
            comprehensive: true, 
            threshold: 0.9,
            useLLM: 'analysis'
        }),
        
        // Calculate confidence and research quality metrics
        evaluate({ 
            criteriaFn: (data) => ({
                confidenceScore: calculateConfidenceScore(data),
                dataGaps: identifyDataGaps(data),
                dataConsistency: assessConsistency(data)
            }),
            outputKey: 'researchQuality'
        }),
        
        // Final prioritization and filtering of data
        prioritize({
            maxItems: {
                'marketLandscape.trends': 8,
                'competitiveAnalysis.directCompetitors': 6,
                'consumerSentiment.keyPraises': 5,
                'consumerSentiment.commonComplaints': 5,
                'swotAnalysis.strengths': 5,
                'swotAnalysis.weaknesses': 5,
                'swotAnalysis.opportunities': 5,
                'swotAnalysis.threats': 5
            },
            useLLM: 'analysis'
        })
    ],
    outputSchema: marketAnalysisSchema
});

// Type inference works automatically
type MarketAnalysis = z.infer<typeof marketAnalysisSchema>;

// Helper functions used in the pipeline
function calculateConfidenceScore(data: any): number {
    // Implementation that calculates confidence based on source quality, data consistency, etc.
    return 0.87;
}

function identifyDataGaps(data: any): string[] {
    // Implementation that identifies missing or underrepresented data points
    return ['Detailed breakdown by vehicle price range', 'Market adoption in rural areas'];
}

function assessConsistency(data: any): number {
    // Implementation that evaluates how consistent the collected data is
    return 0.92;
}
```