/**
 * LLM Integration Research Example
 * 
 * This example demonstrates how to use the deep research tool with different
 * LLM providers from the Vercel AI SDK as drop-in components.
 */
import { 
  research, 
  plan, 
  analyze, 
  factCheck, 
  summarize, 
  searchWeb, 
  extractContent 
} from '../src';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// Mock configuration for search
// In real application, you would use actual API keys
const mockSearchProvider = {
  apiKey: 'mock-api-key',
  cx: 'mock-search-engine-id',
  name: 'search-provider'
};

async function llmIntegrationResearch() {
  console.log('Running LLM integration research example...');
  
  try {
    // Configure environment variables (in a real app, these would be in your .env file)
    process.env.OPENAI_API_KEY = 'your-openai-api-key';
    process.env.ANTHROPIC_API_KEY = 'your-anthropic-api-key';
    process.env.GOOGLE_API_KEY = 'your-google-api-key';
    
    // Define the output schema for our research
    const outputSchema = z.object({
      summary: z.string(),
      keyFindings: z.array(z.string()),
      marketTrends: z.object({
        insights: z.array(z.string()),
        recommendations: z.array(z.string()).optional()
      }),
      technicalAnalysis: z.object({
        insights: z.array(z.string()),
        limitations: z.array(z.string()).optional()
      }),
      factCheckedStatements: z.array(z.object({
        statement: z.string(),
        isValid: z.boolean(),
        confidence: z.number()
      })),
      sources: z.array(z.string().url())
    });

    // Configure a mock search provider
    // In a real implementation, this would use the actual @plust/search-sdk
    const searchProvider = {
      configure: () => mockSearchProvider
    };
    
    const configuredSearch = searchProvider.configure();

    // Execute the research with a custom pipeline using different LLM providers
    const results = await research({
      query: "Future of autonomous vehicles and their impact on urban planning",
      outputSchema,
      steps: [
        // Start with a research plan using OpenAI's GPT-4o
        plan({ 
          llm: openai('gpt-4o'),
          temperature: 0.4,
          includeInResults: true
        }),
        
        // Search the web for information
        searchWeb({ 
          provider: configuredSearch, 
          maxResults: 15 
        }),
        
        // Extract content from the search results
        extractContent({ 
          selectors: 'article, .content, main',
          maxUrls: 10
        }),
        
        // Analyze market trends using Anthropic's Claude
        analyze({
          llm: anthropic('claude-3-opus-20240229'),
          focus: 'market-trends',
          temperature: 0.2,
          depth: 'detailed',
          includeRecommendations: true
        }),
        
        // Analyze technical aspects using Google's Gemini
        analyze({
          llm: google('gemini-1.5-pro'),
          focus: 'technical-details',
          temperature: 0.3,
          depth: 'comprehensive',
          includeEvidence: true
        }),
        
        // Fact check important statements using OpenAI's GPT-4o
        factCheck({
          llm: openai('gpt-4o'),
          temperature: 0.1,
          threshold: 0.7,
          maxStatements: 8,
          includeEvidence: true
        }),
        
        // Summarize all findings using Anthropic's Claude
        summarize({
          llm: anthropic('claude-3-sonnet-20240229'),
          temperature: 0.4,
          maxLength: 2500,
          format: 'structured',
          focus: ['urban planning implications', 'technological challenges', 'regulatory considerations'],
          includeCitations: true
        })
      ],
      config: {
        errorHandling: 'continue',
        timeout: 120000 // 2 minutes
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
  llmIntegrationResearch()
    .then(() => console.log('Example finished'))
    .catch(err => console.error('Example failed:', err));
}

export default llmIntegrationResearch;