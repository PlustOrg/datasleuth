/**
 * Query refinement step for the research pipeline
 * Improves search queries based on previous findings
 */
import * as mastra from 'mastra';
import { createStep } from '../utils/steps.js';
import { ResearchState } from '../types/pipeline.js';
import { z } from 'zod';
import { generateText, generateObject, LanguageModel } from 'ai';
import { ValidationError, LLMError, ConfigurationError } from '../types/errors.js';
import { logger, createStepLogger } from '../utils/logging.js';
import { executeWithRetry } from '../utils/retry.js';

/**
 * Schema for refined query output
 */
const refinedQuerySchema = z.object({
  originalQuery: z.string(),
  refinedQuery: z.string(),
  refinementStrategy: z.string(),
  targetedAspects: z.array(z.string()).optional(),
  reasonForRefinement: z.string().optional(),
});

/**
 * Schema for an array of refined queries
 */
const refinedQueriesArraySchema = z.array(refinedQuerySchema);

export type RefinedQuery = z.infer<typeof refinedQuerySchema>;

/**
 * Options for the query refinement step
 */
export interface RefineQueryOptions {
  /** What to base the refinement on */
  basedOn?: 'findings' | 'gaps' | 'factuality' | 'all';
  /** Language Model to use for query refinement */
  llm?: LanguageModel;
  /** Maximum number of queries to generate */
  maxQueries?: number;
  /** Whether to include the refined queries in the final results */
  includeInResults?: boolean;
  /** Custom prompt for query refinement */
  customPrompt?: string;
  /** Temperature for the LLM (0.0 to 1.0) */
  temperature?: number;
  /** Retry configuration for LLM calls */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
  /** Whether to use simulation instead of actual LLM (for development/testing) */
  useSimulation?: boolean;
}

/**
 * Default query refinement prompt
 */
const DEFAULT_REFINE_QUERY_PROMPT = `
You are an expert research query optimizer. Your task is to refine a search query based on initial findings.

Analyze the search results and current research state to identify:
1. Information gaps that need to be addressed
2. Promising avenues for deeper exploration
3. Areas where the initial query was too broad or too narrow
4. Specific details that require clarification or verification

Create refined queries that will yield more relevant, comprehensive, or accurate information.
Explain the reasoning behind each refinement.
`;

/**
 * Executes query refinement based on research findings
 */
async function executeRefineQueryStep(
  state: ResearchState,
  options: RefineQueryOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('RefineQuery');

  const {
    basedOn = 'all',
    maxQueries = 3,
    includeInResults = false,
    temperature = 0.7,
    llm,
    customPrompt,
    retry = { maxRetries: 2, baseDelay: 1000 },
    useSimulation = false,
  } = options;

  stepLogger.info(`Starting query refinement based on: ${basedOn}`);

  try {
    // Get relevant information from state based on refinement strategy
    const relevantData: Record<string, any> = {
      originalQuery: state.query,
    };

    if (basedOn === 'findings' || basedOn === 'all') {
      relevantData.extractedContent = state.data.extractedContent || [];
      relevantData.searchResults = state.data.searchResults || [];
    }

    if (basedOn === 'gaps' || basedOn === 'all') {
      relevantData.researchPlan = state.data.researchPlan || {};
    }

    if (basedOn === 'factuality' || basedOn === 'all') {
      relevantData.factChecks = state.data.factChecks || [];
    }

    // Use simulation or LLM-based refinement
    let refinedQueries: RefinedQuery[];
    const startTime = Date.now();

    if (useSimulation) {
      stepLogger.info('Using simulation mode for query refinement');
      refinedQueries = await simulateQueryRefinement(
        state.query,
        basedOn,
        relevantData,
        maxQueries
      );
    } else {
      // Use an LLM to generate refined queries
      const modelToUse = llm || state.defaultLLM;

      // If no LLM is available, fall back to simulation
      if (!modelToUse) {
        stepLogger.warn(
          'No language model provided for query refinement, falling back to simulation'
        );
        refinedQueries = await simulateQueryRefinement(
          state.query,
          basedOn,
          relevantData,
          maxQueries
        );
      } else {
        stepLogger.info('Using LLM for query refinement');
        refinedQueries = await generateRefinedQueriesWithLLM(
          state.query,
          basedOn,
          relevantData,
          maxQueries,
          modelToUse,
          temperature,
          customPrompt,
          retry,
          stepLogger
        );
      }
    }

    const timeTaken = Date.now() - startTime;
    stepLogger.info(
      `Query refinement completed in ${timeTaken}ms, generated ${refinedQueries.length} refined queries`
    );

    // Update state with refined queries
    const newState = {
      ...state,
      data: {
        ...state.data,
        refinedQueries,
      },
      metadata: {
        ...state.metadata,
        queryRefinementTimeMs: timeTaken,
      },
    };

    // Add to results if requested
    if (includeInResults) {
      return {
        ...newState,
        results: [...newState.results, { refinedQueries }],
      };
    }

    return newState;
  } catch (error: unknown) {
    // Handle specific error types
    if (
      error instanceof ValidationError ||
      error instanceof LLMError ||
      error instanceof ConfigurationError
    ) {
      // These are already properly formatted errors, just throw them
      throw error;
    }

    // Handle generic errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    stepLogger.error(`Error during query refinement: ${errorMessage}`);

    // Check error patterns to create appropriate error types
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      throw new LLMError({
        message: `Failed to parse LLM response as valid JSON during query refinement: ${errorMessage}`,
        step: 'RefineQuery',
        details: { error },
        retry: true,
        suggestions: [
          'Verify the prompt is properly constructed to elicit JSON',
          'Try a different model that produces more reliable structured output',
          'Consider using a different temperature value',
        ],
      });
    } else if (errorMessage.includes('context') || errorMessage.includes('token limit')) {
      throw new LLMError({
        message: `LLM context length exceeded during query refinement: ${errorMessage}`,
        step: 'RefineQuery',
        details: { error },
        retry: false,
        suggestions: [
          'Reduce the amount of context provided to the model',
          'Use a model with larger context window',
          'Simplify the refinement strategy by focusing on fewer aspects',
        ],
      });
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      throw new LLMError({
        message: `LLM rate limit exceeded during query refinement: ${errorMessage}`,
        step: 'RefineQuery',
        details: { error },
        retry: true,
        suggestions: [
          'Wait and try again later',
          'Implement request throttling in your application',
          'Consider using a different LLM provider or API key',
        ],
      });
    }

    // Generic LLM error fallback
    throw new LLMError({
      message: `Error during query refinement: ${errorMessage}`,
      step: 'RefineQuery',
      details: { originalError: error },
      retry: true,
      suggestions: [
        'Check your LLM configuration',
        'Verify API key and model availability',
        'The LLM service might be experiencing issues, try again later',
      ],
    });
  }
}

/**
 * Simulates query refinement using an LLM
 * In a real implementation, this would call an actual LLM
 */
async function simulateQueryRefinement(
  originalQuery: string,
  strategy: string,
  relevantData: Record<string, any>,
  maxQueries: number
): Promise<RefinedQuery[]> {
  // Simulate a delay as if we're calling an LLM
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Generate simulated refined queries based on the strategy
  const refinedQueries: RefinedQuery[] = [];

  if (strategy === 'findings' || strategy === 'all') {
    // Refine based on extracted content and search results
    refinedQueries.push({
      originalQuery,
      refinedQuery: `${originalQuery} recent developments`,
      refinementStrategy: 'time-focused',
      targetedAspects: ['recency', 'current state'],
      reasonForRefinement:
        'Initial findings lack recent information. Adding time context to focus on newest developments.',
    });

    refinedQueries.push({
      originalQuery,
      refinedQuery: `${originalQuery} analysis comparison`,
      refinementStrategy: 'analytical-depth',
      targetedAspects: ['analysis', 'comparison'],
      reasonForRefinement:
        'Initial results contain factual information but lack analytical depth. Adding analysis focus to get comparative insights.',
    });
  }

  if (strategy === 'gaps' || strategy === 'all') {
    // Refine based on research plan and identified gaps
    const keywords = originalQuery.split(' ');
    if (keywords.length > 2) {
      const specificTerm = keywords[Math.floor(Math.random() * keywords.length)];
      refinedQueries.push({
        originalQuery,
        refinedQuery: `${specificTerm} in context of ${originalQuery}`,
        refinementStrategy: 'deeper-focus',
        targetedAspects: ['specific-component', 'depth'],
        reasonForRefinement: `Initial results lack depth on ${specificTerm}. Focusing specifically on this aspect to fill information gap.`,
      });
    }
  }

  if (strategy === 'factuality' || strategy === 'all') {
    // Refine based on factuality issues
    refinedQueries.push({
      originalQuery,
      refinedQuery: `${originalQuery} evidence research papers`,
      refinementStrategy: 'credibility-enhancement',
      targetedAspects: ['credibility', 'evidence', 'academic'],
      reasonForRefinement:
        'Some facts in initial results need better verification. Targeting academic and research sources for higher factual accuracy.',
    });
  }

  // Ensure we don't exceed the max number of queries
  return refinedQueries.slice(0, maxQueries);
}

/**
 * Generate refined queries using the provided LLM from the AI SDK
 */
async function generateRefinedQueriesWithLLM(
  originalQuery: string,
  basedOn: string,
  relevantData: Record<string, any>,
  maxQueries: number,
  llm: LanguageModel,
  temperature: number,
  customPrompt?: string,
  retry?: { maxRetries?: number; baseDelay?: number },
  stepLogger?: ReturnType<typeof createStepLogger>
): Promise<RefinedQuery[]> {
  // Use default logger if stepLogger not provided
  const logger = stepLogger || createStepLogger('RefineQuery');

  return executeWithRetry(
    async () => {
      try {
        logger.debug(
          `Generating refined queries for: "${originalQuery.substring(0, 50)}${originalQuery.length > 50 ? '...' : ''}"`
        );

        // Prepare context from relevant data
        let contextText = `Original query: "${originalQuery}"\n\n`;

        // Add search results if available
        if (relevantData.searchResults && relevantData.searchResults.length > 0) {
          contextText += 'Search Results:\n';
          relevantData.searchResults.slice(0, 5).forEach((result: any, index: number) => {
            contextText += `${index + 1}. ${result.title} - ${result.snippet || 'No snippet available'}\n`;
          });
          contextText += '\n';
        }

        // Add extracted content if available (summaries only)
        if (relevantData.extractedContent && relevantData.extractedContent.length > 0) {
          contextText += 'Extracted Content Summaries:\n';
          relevantData.extractedContent.slice(0, 3).forEach((content: any, index: number) => {
            const contentSummary = content.content.substring(0, 150) + '...';
            contextText += `${index + 1}. ${content.title}: ${contentSummary}\n`;
          });
          contextText += '\n';
        }

        // Add fact check results if available
        if (relevantData.factChecks && relevantData.factChecks.length > 0) {
          contextText += 'Fact Check Results:\n';
          const validFacts = relevantData.factChecks.filter((check: any) => check.isValid);
          const invalidFacts = relevantData.factChecks.filter((check: any) => !check.isValid);

          contextText += `Valid facts: ${validFacts.length}, Invalid facts: ${invalidFacts.length}\n`;
          if (invalidFacts.length > 0) {
            contextText += 'Examples of invalid facts:\n';
            invalidFacts.slice(0, 2).forEach((fact: any, index: number) => {
              contextText += `${index + 1}. "${fact.statement}" (Confidence: ${fact.confidence})\n`;
            });
          }
          contextText += '\n';
        }

        // Add research plan if available
        if (relevantData.researchPlan && relevantData.researchPlan.objectives) {
          contextText += 'Research Plan Objectives:\n';
          relevantData.researchPlan.objectives.forEach((objective: string, index: number) => {
            contextText += `${index + 1}. ${objective}\n`;
          });
          contextText += '\n';
        }

        // Use default or custom prompt
        const systemPrompt = customPrompt || DEFAULT_REFINE_QUERY_PROMPT;

        logger.debug(`Sending query refinement request to LLM with temperature ${temperature}`);

        // Generate the refined queries using the AI SDK with generateObject
        const { object } = await generateObject({
          model: llm,
          schema: refinedQueriesArraySchema,
          system: systemPrompt,
          prompt: `
Based on the original query and the research context provided, generate ${maxQueries} refined search queries
that will yield more relevant, comprehensive, or accurate information.

Context:
${contextText}

Refinement strategy focus: ${basedOn}

For each refined query, provide:
1. The refined query text
2. The refinement strategy used
3. Targeted aspects that the refinement focuses on
4. The reason for this specific refinement
`,
          temperature,
        });

        // Since we're using generateObject, we don't need to validate the result
        // as it's already validated against the schema
        logger.debug(`Successfully generated ${object.length} refined queries`);
        return object;
      } catch (error: unknown) {
        // If it's already one of our error types, just rethrow it
        if (error instanceof ValidationError || error instanceof LLMError) {
          throw error;
        }

        // Otherwise wrap in LLMError
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error generating refined queries with LLM: ${errorMessage}`);

        throw new LLMError({
          message: `Failed to generate refined queries: ${errorMessage}`,
          step: 'RefineQuery',
          details: { error, originalQuery },
          retry: true,
          suggestions: [
            'Check your LLM configuration',
            'Verify API key and model availability',
            'The model may be experiencing issues, try again later',
          ],
        });
      }
    },
    {
      maxRetries: retry?.maxRetries ?? 2,
      retryDelay: retry?.baseDelay ?? 1000,
      backoffFactor: 2,
      onRetry: (attempt, error, delay) => {
        logger.warn(
          `Retry attempt ${attempt} for query refinement: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying in ${delay}ms...`
        );
      },
    }
  );
}

/**
 * Creates a query refinement step for the research pipeline
 *
 * @param options Configuration options for query refinement
 * @returns A query refinement step for the research pipeline
 */
export function refineQuery(options: RefineQueryOptions = {}): ReturnType<typeof createStep> {
  return createStep(
    'RefineQuery',
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeRefineQueryStep(state, options);
    },
    options
  );
}
