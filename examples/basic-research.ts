/**
 * Basic research example
 * Demonstrates a simple research pipeline with basic steps
 */
import { research } from '../src';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

async function basicResearch() {
  console.log('Running basic research example...');
  
  try {
    // Configure environment variables (in a real app, these would be in your .env file)
    process.env.OPENAI_API_KEY = 'your-openai-api-key';
    
    // Define the output schema for our research
    const outputSchema = z.object({
      summary: z.string(),
      keyFindings: z.array(z.string()),
      sources: z.array(z.string().url())
    });

    // Execute the research with default steps
    // Note: We must provide a defaultLLM when using the default steps since they require LLM capabilities
    const results = await research({
      query: "Latest advancements in quantum computing",
      outputSchema,
      defaultLLM: openai('gpt-4o') // Specify a default LLM to use with all AI-dependent steps
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
    .catch(err => console.error('Example failed:', err));
}

export default basicResearch;