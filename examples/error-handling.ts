/**
 * Example demonstrating error handling in @plust/datasleuth
 */

import { research, plan, searchWeb, extractContent, summarize } from '@plust/datasleuth';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { 
  BaseResearchError, 
  ValidationError, 
  NetworkError, 
  isNetworkError, 
  isLLMError 
} from '@plust/datasleuth';

// Example schema for the research output
const outputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  sources: z.array(z.object({
    url: z.string().url(),
    reliability: z.number().min(0).max(1)
  }))
});

/**
 * Example demonstrating proper error handling for research
 */
async function errorHandlingExample() {
  try {
    console.log('Starting research with error handling...');
    
    // Configure OpenAI as the language model
    const model = openai('gpt-4o');
    
    // Execute research with custom error handling configuration
    const results = await research({
      query: "Latest advancements in quantum computing",
      outputSchema,
      defaultLLM: model,
      steps: [
        plan({ retryable: true }),  // Mark plan step as retryable
        searchWeb({
          provider: {
            name: 'google',
            apiKey: process.env.GOOGLE_API_KEY || 'missing-key'
          },
          maxResults: 10
        }),
        extractContent({ maxUrls: 5 }),
        summarize({ includeCitations: true })
      ],
      config: {
        // Configure error handling
        errorHandling: 'continue',  // Continue on non-critical errors
        continueOnError: true,      // Try to complete the pipeline even with errors
        maxRetries: 3,              // Retry failures up to 3 times
        retryDelay: 1000,           // Wait 1 second before first retry
        backoffFactor: 2,           // Double the wait time for each subsequent retry
        logLevel: 'debug',          // Show detailed logs for better debugging
        timeout: 60000              // Fail if research takes more than 1 minute
      }
    });
    
    console.log('Research completed successfully!');
    console.log('Summary:', results.summary);
    console.log('Key Findings:', results.keyFindings.length);
    console.log('Sources:', results.sources.length);
    
  } catch (error) {
    // Handle different error types
    if (isNetworkError(error)) {
      console.error('Network Error - Check your internet connection:', error.message);
      
      // Log retry suggestion if error is retryable
      if (error.retry) {
        console.log('This error is retryable. You might want to try again later.');
      }
      
    } else if (isLLMError(error)) {
      console.error('Language Model Error:', error.message);
      console.log('Suggestions:', error.suggestions.join('\n'));
      
    } else if (error instanceof ValidationError) {
      console.error('Validation Error:', error.message);
      console.log('Details:', JSON.stringify(error.details, null, 2));
      console.log('Suggestions:', error.suggestions.join('\n'));
      
    } else if (error instanceof BaseResearchError) {
      console.error('Research Error:', error.getFormattedMessage());
      
      // Access the step where the error occurred
      if (error.step) {
        console.error(`Error occurred in step: ${error.step}`);
      }
      
      // Log suggestions if available
      if (error.suggestions.length > 0) {
        console.log('Suggestions:');
        error.suggestions.forEach((suggestion, i) => {
          console.log(`  ${i+1}. ${suggestion}`);
        });
      }
      
    } else {
      console.error('Unknown error:', error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * Example demonstrating how to implement a custom retry mechanism
 */
async function customRetryExample() {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`Attempt ${attempts}/${maxAttempts}`);
      
      const results = await research({
        query: "Impact of climate change on agriculture",
        outputSchema,
        defaultLLM: openai('gpt-4o'),
        config: {
          errorHandling: 'stop',
          logLevel: 'info'
        }
      });
      
      console.log('Research completed successfully!');
      return results;
      
    } catch (error) {
      // Only retry on network errors or rate limits
      if (
        (isNetworkError(error) && error.retry) || 
        (error instanceof BaseResearchError && error.code === 'rate_limited')
      ) {
        if (attempts < maxAttempts) {
          // Calculate delay with exponential backoff
          const delay = 1000 * Math.pow(2, attempts - 1);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('Max retry attempts reached. Giving up.');
          throw error;
        }
      } else {
        // For other errors, don't retry
        console.error('Non-retryable error:', 
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    }
  }
}

// Run the examples
async function main() {
  console.log('=== Error Handling Example ===');
  try {
    await errorHandlingExample();
  } catch (error) {
    console.error('Example failed:', 
      error instanceof Error ? error.message : String(error)
    );
  }
  
  console.log('\n=== Custom Retry Example ===');
  try {
    await customRetryExample();
  } catch (error) {
    console.error('Example failed:', 
      error instanceof Error ? error.message : String(error)
    );
  }
}

main().catch(console.error);