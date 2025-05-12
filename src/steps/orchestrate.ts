/**
 * Orchestration step for the research pipeline
 * Uses mastra agents to make decisions about which tools to use
 */
import * as mastra from 'mastra';
import { createStep } from '../utils/steps.js';
import { ResearchState, ResearchStep } from '../types/pipeline.js';
import {
  ValidationError,
  ConfigurationError,
  LLMError,
  ProcessingError,
  MaxIterationsError,
} from '../types/errors.js';
import { logger, createStepLogger } from '../utils/logging.js';
import { executeWithRetry } from '../utils/retry.js';

/**
 * Options for the orchestration step
 */
export interface OrchestrateOptions {
  /** LLM model to use for orchestration (from the AI library) */
  model: any;
  /** Map of tool names to step functions that can be used by the agent */
  tools: Record<string, ResearchStep>;
  /** Custom prompt for the orchestration agent */
  customPrompt?: string;
  /** Maximum number of iterations */
  maxIterations?: number;
  /** Optional function that determines when to exit orchestration */
  exitCriteria?: (state: ResearchState) => boolean | Promise<boolean>;
  /** Whether to include the orchestration results in the final output */
  includeInResults?: boolean;
  /** Whether to continue if a tool execution fails */
  continueOnError?: boolean;
  /** Retry configuration */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Iteration record for orchestration
 */
export interface OrchestrationIteration {
  iteration: number;
  toolChosen: string;
  reasoning: string;
  timestamp: string;
  error?: string; // Add missing error property
}

/**
 * Default orchestration prompt
 */
const DEFAULT_ORCHESTRATION_PROMPT = `
You are an AI research assistant conducting a deep research task. Your job is to choose the most appropriate tools to answer the research query.

RESEARCH QUERY: {query}

You have access to the following tools:
{tools}

Choose the most appropriate tool at each step to gather information and analyze the data. You can use multiple tools in sequence.
Think step-by-step about what information you need and which tool will help you get it.

Previous actions and their results are stored in your research state.

CURRENT STATE SUMMARY:
{state}

Based on the current state, choose the next action. If you believe you have sufficient information to answer the query, you can choose to finish.
`;

/**
 * Simulates execution of an orchestration agent
 */
async function executeOrchestrationStep(
  state: ResearchState,
  options: OrchestrateOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Orchestration');

  const {
    model,
    tools,
    customPrompt = DEFAULT_ORCHESTRATION_PROMPT,
    maxIterations = 10,
    exitCriteria,
    includeInResults = true,
    continueOnError = false,
    retry = { maxRetries: 2, baseDelay: 1000 },
  } = options;

  try {
    // Validate required parameters
    if (!model) {
      throw new ConfigurationError({
        message: 'No model provided for orchestration',
        step: 'Orchestration',
        details: { options },
        suggestions: [
          'Provide an LLM model via the model parameter',
          "Example: orchestrate({ model: openai('gpt-4'), ... })",
        ],
      });
    }

    if (!tools || typeof tools !== 'object' || Object.keys(tools).length === 0) {
      throw new ConfigurationError({
        message: 'No tools provided for orchestration',
        step: 'Orchestration',
        details: { options },
        suggestions: [
          'Provide at least one tool in the tools object',
          'Tools should be created using step factory functions like searchWeb(), analyze(), etc.',
          'Example: tools: { search: searchWeb(), analyze: analyze() }',
        ],
      });
    }

    if (maxIterations <= 0) {
      throw new ValidationError({
        message: `Invalid maxIterations value: ${maxIterations}. Must be greater than 0.`,
        step: 'Orchestration',
        details: { maxIterations },
        suggestions: ['Provide a positive integer for maxIterations', 'Default is 10 iterations'],
      });
    }

    stepLogger.info(
      `Starting orchestration with ${Object.keys(tools).length} available tools and max ${maxIterations} iterations`
    );

    // In a real implementation, we would instantiate a mastra agent here
    // For now, we'll simulate the agent's decisions with proper error handling

    // Store the tools in the state for reference
    let currentState: ResearchState = {
      ...state,
      data: {
        ...state.data,
        orchestration: {
          availableTools: Object.keys(tools),
          iterations: [] as OrchestrationIteration[],
        },
      },
      metadata: {
        ...state.metadata,
        orchestrationStarted: new Date().toISOString(),
      },
    };

    // Track errors that occur during tool execution
    const toolErrors: Error[] = [];

    // Simulate agent iterations
    const iterations = Math.min(3, maxIterations); // For simulation, we'll just do a few iterations
    const toolKeys = Object.keys(tools);

    for (let i = 0; i < iterations; i++) {
      stepLogger.info(`Executing orchestration iteration ${i + 1}/${iterations}`);

      try {
        // Simulate agent choosing a tool using the model
        // In a real implementation, this would use mastra.runAgent() to make a choice
        const chosenToolKey = toolKeys[i % toolKeys.length];
        const chosenTool = tools[chosenToolKey];

        if (!chosenTool) {
          stepLogger.warn(`Tool "${chosenToolKey}" not found in provided tools`);

          toolErrors.push(
            new ConfigurationError({
              message: `Tool "${chosenToolKey}" not found in provided tools`,
              step: 'Orchestration',
              details: {
                chosenTool: chosenToolKey,
                availableTools: Object.keys(tools),
              },
              suggestions: [
                'Ensure the tool name matches a key in the tools object',
                'Check for typos in tool names',
              ],
            })
          );

          if (!continueOnError) {
            throw toolErrors[toolErrors.length - 1]; // Throw the error we just created
          }

          continue; // Skip to next iteration
        }

        // Record the tool choice
        const iterationRecord: OrchestrationIteration = {
          iteration: i + 1,
          toolChosen: chosenToolKey,
          reasoning: `Chose ${chosenToolKey} because it's the next logical step in the research process.`,
          timestamp: new Date().toISOString(),
        };

        currentState.data.orchestration.iterations.push(iterationRecord);
        stepLogger.debug(`Selected tool: ${chosenToolKey} (iteration ${i + 1})`);

        // Execute the chosen tool with error handling
        try {
          stepLogger.info(`Executing tool: ${chosenToolKey}`);
          const nextState = await chosenTool.execute(currentState);

          // Preserve our orchestration data structure
          currentState = {
            ...nextState,
            data: {
              ...nextState.data,
              orchestration: {
                ...currentState.data.orchestration,
              },
            },
          };

          stepLogger.debug(`Tool ${chosenToolKey} executed successfully`);
        } catch (toolError: unknown) {
          const errorMessage = toolError instanceof Error ? toolError.message : String(toolError);
          stepLogger.error(`Error executing tool ${chosenToolKey}: ${errorMessage}`);

          // Add to tool errors
          toolErrors.push(
            toolError instanceof Error
              ? toolError
              : new ProcessingError({
                  message: `Tool execution failed: ${errorMessage}`,
                  step: 'Orchestration',
                  details: {
                    tool: chosenToolKey,
                    iteration: i + 1,
                    error: toolError,
                  },
                  retry: false,
                })
          );

          // Update iteration record to include error
          iterationRecord.error = errorMessage;

          // If we should not continue on error, throw
          if (!continueOnError) {
            throw toolErrors[toolErrors.length - 1];
          }

          stepLogger.warn(
            `Continuing to next iteration despite tool error due to continueOnError=true`
          );
        }

        // Check exit criteria if provided
        if (exitCriteria) {
          try {
            if (await exitCriteria(currentState)) {
              stepLogger.info('Exit criteria met, ending orchestration');
              break;
            }
          } catch (criteriaError: unknown) {
            const errorMessage =
              criteriaError instanceof Error ? criteriaError.message : String(criteriaError);
            stepLogger.error(`Error in exit criteria function: ${errorMessage}`);

            throw new ProcessingError({
              message: `Exit criteria evaluation failed: ${errorMessage}`,
              step: 'Orchestration',
              details: { error: criteriaError },
              retry: false,
              suggestions: [
                'Check the implementation of your exit criteria function',
                'Ensure it properly handles the state structure',
                'Add error handling to your exit criteria function',
              ],
            });
          }
        }
      } catch (iterationError: unknown) {
        // This catches errors that weren't handled by continueOnError
        if (continueOnError) {
          // If we should continue despite errors, log and continue
          const errorMessage =
            iterationError instanceof Error ? iterationError.message : String(iterationError);
          stepLogger.error(`Error in iteration ${i + 1}: ${errorMessage}`);
          stepLogger.warn(`Continuing to next iteration due to continueOnError=true`);

          // If it's not already in toolErrors, add it
          if (!toolErrors.includes(iterationError as Error)) {
            toolErrors.push(
              iterationError instanceof Error ? iterationError : new Error(errorMessage)
            );
          }
        } else {
          // If we shouldn't continue on errors, rethrow to exit orchestration
          throw iterationError;
        }
      }
    }

    // Synthesize results (in a real implementation, this would be done by the LLM)
    const successfulIterations = currentState.data.orchestration.iterations.filter(
      (i: OrchestrationIteration) => !i.error
    ).length;
    const totalIterations = currentState.data.orchestration.iterations.length;

    const orchestrationResult = {
      summary: `Completed ${totalIterations} iterations of orchestrated research for query: ${state.query}`,
      toolsUsed: currentState.data.orchestration.iterations.map(
        (i: OrchestrationIteration) => i.toolChosen
      ),
      successRate: totalIterations > 0 ? successfulIterations / totalIterations : 0,
      confidence: 0.8 * (successfulIterations / Math.max(1, totalIterations)), // Scale confidence by success rate
      errors: toolErrors.length > 0,
      errorCount: toolErrors.length,
    };

    stepLogger.info(
      `Orchestration complete: ${successfulIterations}/${totalIterations} iterations successful`
    );

    // Add tool errors to the state errors
    const finalState = {
      ...currentState,
      errors: [...currentState.errors, ...toolErrors],
      metadata: {
        ...currentState.metadata,
        orchestrationCompleted: new Date().toISOString(),
        orchestrationSuccessRate: orchestrationResult.successRate,
        orchestrationIterations: totalIterations,
      },
    };

    // Add the final result
    if (includeInResults) {
      return {
        ...finalState,
        results: [
          ...finalState.results,
          {
            orchestrationResult,
            iterations: currentState.data.orchestration.iterations.map(
              (i: OrchestrationIteration) => ({
                iteration: i.iteration,
                tool: i.toolChosen,
                timestamp: i.timestamp,
                error: i.error || null,
              })
            ),
          },
        ],
      };
    }

    return finalState;
  } catch (error: unknown) {
    // Handle different error types appropriately
    if (
      error instanceof ValidationError ||
      error instanceof ConfigurationError ||
      error instanceof ProcessingError ||
      error instanceof LLMError
    ) {
      // These are already properly formatted, just throw them
      throw error;
    }

    // Otherwise wrap in a generic ProcessingError
    const errorMessage = error instanceof Error ? error.message : String(error);
    stepLogger.error(`Orchestration failed: ${errorMessage}`);

    throw new ProcessingError({
      message: `Orchestration failed: ${errorMessage}`,
      step: 'Orchestration',
      details: { error, options },
      retry: true,
      suggestions: [
        'Check your orchestration configuration',
        'Verify that all tools are properly implemented',
        'Ensure the LLM model is properly configured',
        'Consider setting continueOnError=true to handle tool failures',
      ],
    });
  }
}

/**
 * Creates an orchestration step that uses mastra agents to make decisions
 *
 * @param options Configuration for the orchestration
 * @returns An orchestration step for the research pipeline
 */
export function orchestrate(options: OrchestrateOptions): ReturnType<typeof createStep> {
  return createStep(
    'Orchestration',
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeOrchestrationStep(state, options);
    },
    options,
    {
      // Add retry configuration to the step metadata
      retryable: true,
      maxRetries: options.retry?.maxRetries || 2,
      retryDelay: options.retry?.baseDelay || 1000,
      backoffFactor: 2,
    }
  );
}
