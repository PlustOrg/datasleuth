/**
 * Basic research example
 * Demonstrates a simple research pipeline with basic steps
 */
import { research } from '../src';
import { z } from 'zod';

async function basicResearch() {
  console.log('Running basic research example...');
  
  try {
    // Define the output schema for our research
    const outputSchema = z.object({
      summary: z.string(),
      keyFindings: z.array(z.string()),
      sources: z.array(z.string().url())
    });

    // Execute the research with default steps
    const results = await research({
      query: "Latest advancements in quantum computing",
      outputSchema
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