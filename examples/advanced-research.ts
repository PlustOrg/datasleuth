/**
 * Advanced research example
 * Demonstrates a custom research pipeline with multiple steps
 */
import { 
  research, 
  plan, 
  searchWeb, 
  extractContent, 
  evaluate, 
  repeatUntil 
} from '../src';
import { z } from 'zod';

// Mock configuration for Google search
// In real application, you would use actual API keys
const mockGoogleSearch = {
  apiKey: 'mock-api-key',
  cx: 'mock-search-engine-id',
  name: 'google'
};

async function advancedResearch() {
  console.log('Running advanced research example...');
  
  try {
    // Define the output schema for our research
    const outputSchema = z.object({
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
    });

    // Configure a mock search provider
    // In a real implementation, this would use the actual @plust/search-sdk
    const googleSearch = {
      configure: () => mockGoogleSearch
    };
    
    const configuredGoogle = googleSearch.configure();

    // Execute the research with a custom pipeline
    const results = await research({
      query: "Impact of climate change on agriculture",
      outputSchema,
      steps: [
        // Start with a research plan
        plan(),
        
        // Search the web for information
        searchWeb({ 
          provider: configuredGoogle, 
          maxResults: 10 
        }),
        
        // Extract content from the search results
        extractContent({ 
          selectors: 'article, .content, main' 
        }),
        
        // Repeat until we have enough sources
        repeatUntil(
          evaluate({ 
            criteriaFn: (state) => 
              (state.data.searchResults?.length || 0) > 5 
          }),
          [
            // If we don't have enough sources, search again with refined query
            searchWeb({ 
              provider: configuredGoogle,
              maxResults: 5
            }),
            extractContent()
          ],
          { maxIterations: 3 }
        ),
        
        // One more search with a different focus (simulated here)
        searchWeb({
          provider: configuredGoogle,
          maxResults: 5,
        }),
        
        extractContent({
          maxUrls: 3,
          includeInResults: true
        })
      ],
      config: {
        errorHandling: 'continue',
        timeout: 60000 // 1 minute
      }
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
    .catch(err => console.error('Example failed:', err));
}

export default advancedResearch;