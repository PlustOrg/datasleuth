import { z } from 'zod';
import { 
  ResearchInput, 
  ResearchStep, 
  ResearchResult, 
  ResearchState, 
  StepOptions 
} from '../types/pipeline';
import { createInitialState, executePipeline } from './pipeline';
import { plan } from '../steps/plan';
import { searchWeb } from '../steps/searchWeb';
import { extractContent } from '../steps/extractContent';
import { factCheck } from '../steps/factCheck';
import { summarize } from '../steps/summarize';

// Define a more specific type for the steps schema using our defined types
const researchStepSchema = z.object({
  name: z.string(),
  execute: z.function()
    .args(z.custom<ResearchState>())
    .returns(z.promise(z.custom<ResearchState>())),
  rollback: z.function()
    .args(z.custom<ResearchState>())
    .returns(z.promise(z.custom<ResearchState>()))
    .optional(),
  options: z.record(z.string(), z.any()).optional()
});

/**
 * Main research function - the primary API for the package
 * 
 * @param input The research input with query, output schema, optional steps, and default LLM
 * @returns The research results in the structure defined by outputSchema
 */
export async function research(input: ResearchInput): Promise<ResearchResult> {
  // Validate the input against the schema
  const { query, outputSchema, steps = [], config = {}, defaultLLM } = input;

  // Create the initial pipeline state
  const initialState = createInitialState(query, outputSchema);
  
  // Add the default LLM to the state if provided
  if (defaultLLM) {
    initialState.defaultLLM = defaultLLM;
  }

  // If no steps provided, add default steps
  const pipelineSteps = steps.length > 0 ? steps : getDefaultSteps(query);
  
  // If we're using default steps and no defaultLLM is provided, throw an error
  if (steps.length === 0 && !defaultLLM) {
    throw new Error(
      "No language model provided for research. When using default steps, you must provide a defaultLLM parameter. " +
      "For example: research({ query, outputSchema, defaultLLM: openai('gpt-4o') })"
    );
  }

  // Execute the pipeline with the provided steps and configuration
  const finalState = await executePipeline(initialState, pipelineSteps, config);

  // Check for errors
  if (finalState.errors.length > 0) {
    const errorMessage = finalState.errors.map(err => err.message).join('; ');
    throw new Error(`Research pipeline failed: ${errorMessage}`);
  }

  // If no results were produced, return a helpful error
  if (finalState.results.length === 0) {
    throw new Error('Research completed but produced no results');
  }

  // Get the final result (usually the last one or a combined result)
  const result = finalState.results[finalState.results.length - 1];

  // Validate the result against the output schema
  return outputSchema.parse(result);
}

/**
 * Interface for a mock search provider
 */
export interface MockSearchProvider {
  name: string;
  apiKey: string;
  [key: string]: string;
}

/**
 * Get default pipeline steps if none are provided
 * Creates a comprehensive research pipeline with planning, searching, 
 * content extraction, fact checking, and summarization
 * 
 * Note: These steps will require a defaultLLM to be provided to the research function
 */
function getDefaultSteps(query: string): ResearchStep[] {
  // Mock search provider for demonstration
  // In a real implementation, users would need to configure this
  const mockSearchProvider: MockSearchProvider = {
    name: 'google',
    apiKey: 'mock-api-key'
  };

  return [
    // Start with research planning (requires an LLM)
    plan({
      includeInResults: false
    }),
    
    // Search the web for information
    searchWeb({
      provider: mockSearchProvider,
      maxResults: 10,
      useQueriesFromPlan: true,
      includeInResults: false
    }),
    
    // Extract content from search results
    extractContent({
      maxUrls: 5,
      maxContentLength: 5000,
      includeInResults: false
    }),
    
    // Fact check extracted information (requires an LLM)
    factCheck({
      threshold: 0.7,
      includeEvidence: true,
      includeInResults: false
    }),
    
    // Summarize the findings (requires an LLM)
    summarize({
      maxLength: 2000,
      format: 'structured',
      includeCitations: true,
      includeInResults: true
    })
  ];
}