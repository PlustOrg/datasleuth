/**
 * Basic research example
 * Demonstrates a simple research pipeline with basic steps
 */
import { research } from '../src';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { google } from '@plust/search-sdk';

async function basicResearch() {
  console.log('Running basic research example...');

  try {
    // Configure environment variables (in a real app, these would be in your .env file)
    process.env.OPENAI_API_KEY = 'your-openai-api-key';
    process.env.GOOGLE_API_KEY = 'your-google-api-key';
    process.env.GOOGLE_CX = 'your-google-cx-id';

    // Define the output schema for our research
    const outputSchema = z.object({
      summary: z.string(),
      keyFindings: z.array(z.string()),
      sources: z.array(z.string().url()),
    });

    // Configure the search provider
    const searchProvider = google.configure({
      apiKey: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_CX,
    });

    // Execute the research with default steps
    // Note: We must provide both defaultLLM and defaultSearchProvider when using the default steps
    const results = await research({
      query: 'Latest advancements in quantum computing',
      outputSchema,
      defaultLLM: openai('gpt-4o'), // Specify a default LLM to use with all AI-dependent steps
      defaultSearchProvider: searchProvider, // Specify a default search provider for web searches
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
  basicResearch()
    .then(() => console.log('Example finished'))
    .catch((err) => console.error('Example failed:', err));
}

export default basicResearch;
