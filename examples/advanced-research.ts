/**
 * Advanced research example
 * Demonstrates a custom research pipeline with multiple steps
 */
import { research, plan, searchWeb, extractContent, evaluate, repeatUntil } from '../src';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { google } from '@plust/search-sdk';

async function advancedResearch() {
  console.log('Running advanced research example...');

  try {
    // Configure environment variables (in a real app, these would be in your .env file)
    process.env.OPENAI_API_KEY = 'your-openai-api-key';
    process.env.GOOGLE_API_KEY = 'your-google-api-key';
    process.env.GOOGLE_CX = 'your-google-cx-id';

    // Define the output schema for our research
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

    // Configure the default language model and search provider
    const llm = openai('gpt-4o');
    const searchProvider = google.configure({
      apiKey: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_CX,
    });

    // Execute the research with a custom pipeline
    const results = await research({
      query: 'Impact of climate change on agriculture',
      outputSchema,
      // Set the default LLM and search provider that all steps can use
      defaultLLM: llm,
      defaultSearchProvider: searchProvider,
      steps: [
        // Start with a research plan that will use the defaultLLM
        plan(),

        // Search the web using the defaultSearchProvider
        searchWeb({
          maxResults: 10,
          // No need to specify provider as it will use defaultSearchProvider
        }),

        // Extract content from the search results
        extractContent({
          selectors: 'article, .content, main',
        }),

        // Repeat until we have enough sources
        repeatUntil(
          evaluate({
            criteriaFn: (state) => (state.data.searchResults?.length || 0) > 5,
          }),
          [
            // If we don't have enough sources, search again with refined query
            searchWeb({
              maxResults: 5,
              // Again, uses defaultSearchProvider automatically
            }),
            extractContent(),
          ],
          { maxIterations: 3 }
        ),

        // One more search with a different focus
        searchWeb({
          // You can still override the default provider for a specific step if needed
          // provider: alternativeProvider,
          maxResults: 5,
          query: 'climate change agriculture solutions innovative',
        }),

        extractContent({
          maxUrls: 3,
          includeInResults: true,
        }),
      ],
      config: {
        errorHandling: 'continue',
        timeout: 60000, // 1 minute
      },
    });

    console.log('Research completed successfully!');
    console.log(JSON.stringify(results, null, 2));

    return results;
  } catch (error) {
    console.error('Research failed:', error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  advancedResearch()
    .then(() => console.log('Example finished'))
    .catch((err) => console.error('Example failed:', err));
}

export default advancedResearch;
