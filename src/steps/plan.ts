/**
 * Research planning step for the research pipeline
 * Creates structured research plan with objectives and search queries
 */
import { createStep } from '../utils/steps';
import { ResearchState } from '../types/pipeline';
import { z } from 'zod';
import { generateText, generateObject, LanguageModel } from 'ai';
import { 
  ValidationError, 
  LLMError, 
  ConfigurationError 
} from '../types/errors';
import { logger, createStepLogger } from '../utils/logging';
import { executeWithRetry } from '../utils/retry';

// Schema for research plan output
const researchPlanSchema = z.object({
  objectives: z.array(z.string()),
  searchQueries: z.array(z.string()),
  relevantFactors: z.array(z.string()),
  dataGatheringStrategy: z.string(),
  expectedOutcomes: z.array(z.string()),
});

// Type for research plan
export type ResearchPlan = z.infer<typeof researchPlanSchema>;

/**
 * Default system prompt for the planning agent
 */
const DEFAULT_PLANNING_PROMPT = `
You are a research planning assistant. Your job is to create a structured research plan based on a query.
Analyze the query carefully and develop a comprehensive strategy for researching this topic.

For the plan, provide:
1. Main research objectives (3-5 specific goals)
2. Specific search queries that would yield useful information (5-8 queries)
3. Key factors or aspects that are relevant to this research
4. An overall data gathering strategy
5. Expected outcomes from the research

Be specific, practical, and thorough. Consider what types of information would be most valuable to answer the query.
`;

/**
 * Options for the planning step
 */
export interface PlanOptions {
  /** Custom system prompt to override the default */
  customPrompt?: string;
  /** Model to use for planning (from the AI SDK) */
  llm?: LanguageModel;
  /** Temperature for the LLM (0.0 to 1.0) */
  temperature?: number;
  /** Whether to include the research plan in the final results */
  includeInResults?: boolean;
  /** Retry configuration */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Creates a research plan using an LLM
 */
async function executePlanStep(
  state: ResearchState,
  options: PlanOptions = {}
): Promise<ResearchState> {
  const stepLogger = createStepLogger('ResearchPlanning');
  
  const {
    customPrompt = DEFAULT_PLANNING_PROMPT,
    temperature = 0.4,
    includeInResults = true,
    llm,
    retry = { maxRetries: 2, baseDelay: 1000 }
  } = options;

  stepLogger.info('Starting research plan generation');

  try {
    // Check for an LLM to use - either from options or from state
    const modelToUse = llm || state.defaultLLM;
    
    // If no LLM is available, throw an error
    if (!modelToUse) {
      throw new ConfigurationError({
        message: "No language model provided for planning step",
        step: 'ResearchPlanning',
        details: { options },
        suggestions: [
          "Provide an LLM in the step options using the 'llm' parameter",
          "Set a defaultLLM when initializing the research function",
          "Example: research({ defaultLLM: openai('gpt-4'), ... })"
        ]
      });
    }

    const startTime = Date.now();
    
    // Generate research plan using the LLM with retry logic
    const researchPlan = await generateResearchPlanWithLLM(
      state.query, 
      customPrompt, 
      modelToUse, 
      temperature,
      retry,
      stepLogger
    );
    
    const timeTaken = Date.now() - startTime;
    stepLogger.info(`Research plan generated successfully in ${timeTaken}ms`);
    stepLogger.debug(`Generated ${researchPlan.searchQueries.length} search queries and ${researchPlan.objectives.length} objectives`);

    // Store the plan in state for later steps to use
    const newState = {
      ...state,
      data: {
        ...state.data,
        researchPlan,
      },
      metadata: {
        ...state.metadata,
        planningTimeMs: timeTaken
      }
    };

    // Add the plan to results if requested
    if (includeInResults) {
      return {
        ...newState,
        results: [...newState.results, { researchPlan }],
      };
    }

    return newState;
  } catch (error: unknown) {
    // Handle specific error types
    if (error instanceof ValidationError || 
        error instanceof LLMError || 
        error instanceof ConfigurationError) {
      // These are already properly formatted errors, just throw them
      throw error;
    }
    
    // Handle generic errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    stepLogger.error(`Error during research planning: ${errorMessage}`);
    
    // Check error patterns to create appropriate error types
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      throw new LLMError({
        message: `Failed to parse LLM response as valid JSON during planning: ${errorMessage}`,
        step: 'ResearchPlanning', 
        details: { error },
        retry: true,
        suggestions: [
          "Verify the prompt is properly constructed to elicit JSON",
          "Try a different model that produces more reliable structured output",
          "Consider using a different temperature value"
        ]
      });
    } else if (errorMessage.includes('context') || errorMessage.includes('token limit')) {
      throw new LLMError({
        message: `LLM context length exceeded during planning: ${errorMessage}`,
        step: 'ResearchPlanning',
        details: { error },
        retry: false,
        suggestions: [
          "Simplify the query",
          "Use a model with larger context window",
          "Reduce the customPrompt length"
        ]
      });
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      throw new LLMError({
        message: `LLM rate limit exceeded during planning: ${errorMessage}`,
        step: 'ResearchPlanning',
        details: { error },
        retry: true,
        suggestions: [
          "Wait and try again later",
          "Implement request throttling in your application",
          "Consider using a different LLM provider or API key"
        ]
      });
    }
    
    // Generic LLM error fallback
    throw new LLMError({
      message: `Error during research planning: ${errorMessage}`,
      step: 'ResearchPlanning',
      details: { originalError: error },
      retry: true,
      suggestions: [
        "Check your LLM configuration",
        "Verify API key and model availability",
        "The LLM service might be experiencing issues, try again later"
      ]
    });
  }
}

/**
 * Generate a research plan using the provided LLM from the AI SDK
 */
async function generateResearchPlanWithLLM(
  query: string, 
  systemPrompt: string, 
  llm: LanguageModel,
  temperature: number,
  retry?: { maxRetries?: number; baseDelay?: number },
  stepLogger?: ReturnType<typeof createStepLogger>
): Promise<ResearchPlan> {
  // Use default logger if stepLogger not provided
  const logger = stepLogger || createStepLogger('ResearchPlanning');
  
  return executeWithRetry(
    async () => {
      try {
        logger.debug(`Generating research plan for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
        
        // Generate the research plan using the AI SDK with generateObject
        const { object } = await generateObject({
          model: llm,
          schema: researchPlanSchema,
          system: systemPrompt,
          prompt: `Create a detailed research plan for the query: "${query}"`,
          temperature,
        });

        logger.debug(`Successfully generated research plan with ${object.searchQueries.length} search queries`);
        return object;
      } catch (error: unknown) {
        // If it's already one of our error types, just rethrow it
        if (error instanceof ValidationError || error instanceof LLMError) {
          throw error;
        }
        
        // Otherwise wrap in LLMError
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error generating research plan with LLM: ${errorMessage}`);
        
        throw new LLMError({
          message: `Failed to generate research plan: ${errorMessage}`,
          step: 'ResearchPlanning',
          details: { error, query },
          retry: true,
          suggestions: [
            "Check your LLM configuration",
            "Verify API key and model availability",
            "The model may be experiencing issues, try again later"
          ]
        });
      }
    },
    {
      maxRetries: retry?.maxRetries ?? 2,
      retryDelay: retry?.baseDelay ?? 1000,
      backoffFactor: 2,
      onRetry: (attempt, error, delay) => {
        logger.warn(`Retry attempt ${attempt} for research plan: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying in ${delay}ms...`);
      }
    }
  );
}

/**
 * Creates a planning step for the research pipeline
 * 
 * @param options Configuration options for the planning step
 * @returns A planning step for the research pipeline
 */
export function plan(options: PlanOptions = {}): ReturnType<typeof createStep> {
  return createStep(
    'ResearchPlanning', 
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executePlanStep(state, options);
    }, 
    options,
    {
      // Mark as retryable by default for the entire step
      retryable: true,
      maxRetries: 2,
      retryDelay: 1000,
      backoffFactor: 2
    }
  );
}