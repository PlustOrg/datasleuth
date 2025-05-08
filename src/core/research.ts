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

// Define the input schema for the research function
const researchInputSchema = z.object({
  query: z.string(),
  outputSchema: z.custom<z.ZodType<ResearchResult>>((val) => val instanceof z.ZodType), 
  steps: z.array(researchStepSchema).optional(), 
  config: z.record(z.string(), z.any()).optional(),
});

/**
 * Main research function - the primary API for the package
 * 
 * @param input The research input with query, output schema, and optional steps
 * @returns The research results in the structure defined by outputSchema
 */
export async function research(input: unknown): Promise<ResearchResult> {
  // Validate the input against the schema
  const validatedInput = researchInputSchema.parse(input) as ResearchInput;
  const { query, outputSchema, steps = [], config = {} } = validatedInput;

  // Create the initial pipeline state
  const initialState = createInitialState(query, outputSchema);

  // If no steps provided, we'll need to add default steps later
  const pipelineSteps = steps.length > 0 ? steps : getDefaultSteps(query);

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
 */
function getDefaultSteps(query: string): ResearchStep[] {
  // Mock search provider for demonstration
  // In a real implementation, users would need to configure this
  const mockSearchProvider: MockSearchProvider = {
    name: 'google',
    apiKey: 'mock-api-key'
  };

  return [
    // Start with research planning
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
    
    // Fact check extracted information
    factCheck({
      threshold: 0.7,
      includeEvidence: true,
      includeInResults: false
    }),
    
    // Summarize the findings
    summarize({
      maxLength: 2000,
      format: 'structured',
      includeCitations: true,
      includeInResults: true
    })
  ];
}