/**
 * Orchestration step for the research pipeline
 * Uses AI-powered agents to make decisions about which tools to use
 */
import { createStep } from '../utils/steps.js';
import { ResearchState, ResearchStep } from '../types/pipeline.js';
import { ValidationError, ConfigurationError, LLMError, ProcessingError } from '../types/errors.js';
import { createStepLogger } from '../utils/logging.js';
import { generateText, generateObject, LanguageModel } from 'ai';
import { executeWithRetry } from '../utils/retry.js';
import { z } from 'zod';

// Add imports for all built-in steps
import { plan } from './plan.js';
import { searchWeb } from './searchWeb.js';
import { extractContent } from './extractContent.js';
import { factCheck } from './factCheck.js';
import { analyze } from './analyze.js';
import { summarize } from './summarize.js';
import { refineQuery } from './refineQuery.js';
import { classify } from './classify.js';
import { transform } from './transform.js';

/**
 * Options for the orchestration step
 */
export interface OrchestrateOptions {
  /** LLM model to use for orchestration (from the AI library) */
  model: LanguageModel;
  /** Default search provider to use for search-dependent steps */
  searchProvider?: any;
  /** Map of tool names to step functions that can be used by the agent */
  tools?: Record<string, ResearchStep>;
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
  /** Custom tool selection function (if provided, uses this instead of LLM) */
  toolSelectorFn?: (
    state: ResearchState,
    availableTools: string[]
  ) => Promise<{
    toolName: string;
    reasoning: string;
  }>;
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
  error?: string;
  result?: string;
}

/**
 * Schema for tool selection by LLM
 */
const toolSelectionSchema = z.object({
  tool: z.string(),
  reasoning: z.string().min(5),
});

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

Based on the current state, choose the next action. If you believe you have sufficient information to answer the query, you can finish by selecting "finish".

Respond with ONLY the name of the tool to use next and your reasoning. Format your response as JSON with "tool" and "reasoning" fields.
`;

/**
 * Creates a state summary for the LLM context
 */
function createStateSummary(state: ResearchState): string {
  const parts: string[] = [];

  // Add the query
  parts.push(`Query: "${state.query}"`);

  // Add plan information if available
  if (state.data.researchPlan) {
    parts.push('\nResearch Plan:');
    if (Array.isArray(state.data.researchPlan.objectives)) {
      parts.push('Objectives:');
      state.data.researchPlan.objectives.forEach((obj: string, i: number) => {
        parts.push(`${i + 1}. ${obj}`);
      });
    }
  }

  // Add search results summary if available
  if (state.data.searchResults && state.data.searchResults.length > 0) {
    parts.push(`\nSearch Results: ${state.data.searchResults.length} results found`);
    state.data.searchResults.slice(0, 3).forEach((result, i) => {
      parts.push(`${i + 1}. ${result.title} - ${result.snippet || 'No snippet'}`);
    });
    if (state.data.searchResults.length > 3) {
      parts.push(`... and ${state.data.searchResults.length - 3} more results.`);
    }
  }

  // Add extracted content summary if available
  if (state.data.extractedContent && state.data.extractedContent.length > 0) {
    parts.push(`\nExtracted Content: ${state.data.extractedContent.length} pages extracted`);
    state.data.extractedContent.slice(0, 3).forEach((content, i) => {
      parts.push(`${i + 1}. ${content.title} (${content.url})`);
    });
    if (state.data.extractedContent.length > 3) {
      parts.push(`... and ${state.data.extractedContent.length - 3} more pages.`);
    }
  }

  // Add fact check summary if available
  if (state.data.factChecks && state.data.factChecks.length > 0) {
    parts.push(`\nFact Checks: ${state.data.factChecks.length} statements checked`);
    const validFacts = state.data.factChecks.filter((f) => f.isValid).length;
    parts.push(
      `${validFacts} valid statements, ${state.data.factChecks.length - validFacts} invalid statements`
    );
  }

  // Add analysis summary if available
  if (state.data.analysis) {
    parts.push('\nAnalysis Results:');
    Object.entries(state.data.analysis).forEach(([focus, analysis]) => {
      parts.push(
        `- Analysis on "${focus}" with ${analysis.insights ? analysis.insights.length : 0} insights`
      );
    });
  }

  // Add summary if available
  if (state.data.summary) {
    parts.push('\nSummary Available: Yes');
  }

  // Add orchestration history if available
  if (state.data.orchestration && state.data.orchestration.iterations) {
    parts.push('\nPrevious Actions:');
    state.data.orchestration.iterations.forEach((iteration: OrchestrationIteration) => {
      parts.push(`- Iteration ${iteration.iteration}: Used tool "${iteration.toolChosen}"`);
      if (iteration.result) {
        parts.push(
          `  Result: ${iteration.result.substring(0, 100)}${iteration.result.length > 100 ? '...' : ''}`
        );
      }
      if (iteration.error) {
        parts.push(`  Error: ${iteration.error}`);
      }
    });
  }

  return parts.join('\n');
}

/**
 * Creates a summary of available tools for the LLM
 */
function createToolsSummary(tools: Record<string, ResearchStep>): string {
  const parts: string[] = [];

  Object.entries(tools).forEach(([name, step]) => {
    parts.push(`- ${name}: ${getToolDescription(name, step)}`);
  });

  // Add "finish" as a special tool
  parts.push('- finish: Complete the research process and return the current results');

  return parts.join('\n');
}

/**
 * Get a description for a tool based on its name or type
 */
function getToolDescription(name: string, step: ResearchStep): string {
  // Specific descriptions based on common step names
  switch (name) {
    case 'plan':
      return 'Creates a structured research plan with objectives and search queries';
    case 'searchWeb':
      return 'Searches the web for information using the configured search provider';
    case 'extractContent':
      return 'Extracts content from URLs found in search results';
    case 'factCheck':
      return 'Validates information accuracy using AI';
    case 'analyze':
      return 'Performs specialized analysis on the collected data';
    case 'summarize':
      return 'Synthesizes the findings into a structured format';
    case 'refineQuery':
      return 'Improves search queries based on findings so far';
    case 'classify':
      return 'Classifies entities and concepts found in the research';
    case 'transform':
      return 'Transforms the research results to match the expected output schema';
    default:
      // For custom tools, use the step name
      return `Custom tool "${step.name}"`;
  }
}

/**
 * Get the tool execution result as a string summary
 */
function getToolResultSummary(state: ResearchState, prevState: ResearchState): string {
  // Compare the current state with the previous state to see what changed
  const changes: string[] = [];

  // Check for new research plan
  if (!prevState.data.researchPlan && state.data.researchPlan) {
    changes.push('Created research plan with objectives and search queries');
  }

  // Check for new search results
  const prevSearchCount = prevState.data.searchResults?.length || 0;
  const currSearchCount = state.data.searchResults?.length || 0;
  if (currSearchCount > prevSearchCount) {
    changes.push(`Added ${currSearchCount - prevSearchCount} new search results`);
  }

  // Check for new extracted content
  const prevContentCount = prevState.data.extractedContent?.length || 0;
  const currContentCount = state.data.extractedContent?.length || 0;
  if (currContentCount > prevContentCount) {
    changes.push(`Extracted content from ${currContentCount - prevContentCount} new pages`);
  }

  // Check for new fact checks
  const prevFactCount = prevState.data.factChecks?.length || 0;
  const currFactCount = state.data.factChecks?.length || 0;
  if (currFactCount > prevFactCount) {
    changes.push(`Added ${currFactCount - prevFactCount} new fact checks`);
  }

  // Check for new analysis
  const prevAnalysisCount = prevState.data.analysis
    ? Object.keys(prevState.data.analysis).length
    : 0;
  const currAnalysisCount = state.data.analysis ? Object.keys(state.data.analysis).length : 0;
  if (currAnalysisCount > prevAnalysisCount) {
    changes.push(`Added ${currAnalysisCount - prevAnalysisCount} new analysis results`);
  }

  // Check for new summary
  if (!prevState.data.summary && state.data.summary) {
    changes.push('Generated a summary of the research');
  }

  // Add a fallback if no changes detected
  if (changes.length === 0) {
    return 'Tool executed successfully but no significant changes detected';
  }

  return changes.join('. ');
}

/**
 * Executes the orchestration agent with real LLM decision making
 */
async function executeOrchestrationStep(
  state: ResearchState,
  options: OrchestrateOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Orchestration');

  const {
    model,
    searchProvider,
    tools = {},
    customPrompt = DEFAULT_ORCHESTRATION_PROMPT,
    maxIterations = 10,
    exitCriteria,
    includeInResults = true,
    continueOnError = false,
    toolSelectorFn,
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
          "Example: orchestrate({ model: openai('gpt-4o'), ... })",
        ],
      });
    }

    // Create or extend the tools with built-in steps if needed
    const allTools: Record<string, ResearchStep> = { ...tools };

    // Add built-in tools if not already present
    if (!allTools.plan) {
      allTools.plan = plan({ llm: model });
    }

    if (!allTools.searchWeb && searchProvider) {
      allTools.searchWeb = searchWeb({ provider: searchProvider });
    } else if (!allTools.searchWeb && !searchProvider && state.defaultSearchProvider) {
      allTools.searchWeb = searchWeb({ provider: state.defaultSearchProvider });
    }

    if (!allTools.extractContent) {
      allTools.extractContent = extractContent();
    }

    if (!allTools.factCheck) {
      allTools.factCheck = factCheck({ llm: model });
    }

    if (!allTools.analyze) {
      allTools.analyze = analyze({ llm: model, focus: 'general' });
    }

    if (!allTools.summarize) {
      allTools.summarize = summarize({ llm: model });
    }

    if (!allTools.refineQuery) {
      allTools.refineQuery = refineQuery({ llm: model });
    }

    if (!allTools.classify) {
      allTools.classify = classify();
    }

    if (!allTools.transform) {
      allTools.transform = transform({ llm: model });
    }

    // Validate that we have at least one tool
    if (Object.keys(allTools).length === 0) {
      throw new ConfigurationError({
        message: 'No tools provided for orchestration',
        step: 'Orchestration',
        details: { options },
        suggestions: [
          'Provide at least one tool in the tools object',
          'Provide a searchProvider for the built-in searchWeb tool',
          'Examples: tools: { search: searchWeb(), analyze: analyze() }',
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
      `Starting orchestration with ${Object.keys(allTools).length} available tools and max ${maxIterations} iterations`
    );

    // Initialize the state with orchestration data
    let currentState: ResearchState = {
      ...state,
      data: {
        ...state.data,
        orchestration: {
          availableTools: Object.keys(allTools),
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

    // Start with a planning phase if there's no plan yet
    if (!currentState.data.researchPlan && !toolSelectorFn) {
      stepLogger.info('No research plan found, starting with plan step');
      try {
        const planTool = allTools.plan;
        const planState = await planTool.execute(currentState);

        // Add the plan action to our history
        const planRecord: OrchestrationIteration = {
          iteration: 0, // Planning is iteration 0
          toolChosen: 'plan',
          reasoning: 'Starting research with a structured plan to guide the process',
          timestamp: new Date().toISOString(),
          result: 'Research plan created with objectives and search queries',
        };

        // Update state with plan results
        currentState = {
          ...planState,
          data: {
            ...planState.data,
            orchestration: {
              availableTools: Object.keys(allTools),
              iterations: [planRecord],
            },
          },
        };

        stepLogger.debug('Plan step completed successfully');
      } catch (planError) {
        // If planning fails but we should continue, log and proceed
        if (continueOnError) {
          const errorMessage = planError instanceof Error ? planError.message : String(planError);
          stepLogger.error(`Plan step failed: ${errorMessage}`);
          stepLogger.warn('Continuing without a plan due to continueOnError=true');

          // Record the failed planning
          const planRecord: OrchestrationIteration = {
            iteration: 0,
            toolChosen: 'plan',
            reasoning: 'Starting research with a structured plan to guide the process',
            timestamp: new Date().toISOString(),
            error: errorMessage,
          };

          currentState.data.orchestration.iterations.push(planRecord);
          toolErrors.push(planError instanceof Error ? planError : new Error(errorMessage));
        } else {
          // If planning fails and we shouldn't continue, rethrow
          throw planError;
        }
      }
    }

    // Main orchestration loop
    for (let i = 0; i < maxIterations; i++) {
      const iterationNumber = i + 1;
      stepLogger.info(`Executing orchestration iteration ${iterationNumber}/${maxIterations}`);

      try {
        // Choose the next tool - either using custom selector or LLM
        let chosenToolKey: string;
        let reasoning: string;

        if (toolSelectorFn) {
          // Use the custom tool selector function
          stepLogger.debug('Using custom tool selector function');
          try {
            const { toolName, reasoning: toolReasoning } = await toolSelectorFn(
              currentState,
              Object.keys(allTools)
            );
            chosenToolKey = toolName;
            reasoning = toolReasoning;
          } catch (selectorError) {
            throw new ProcessingError({
              message: `Custom tool selector function failed: ${selectorError instanceof Error ? selectorError.message : String(selectorError)}`,
              step: 'Orchestration',
              details: { error: selectorError },
              retry: false,
              suggestions: [
                'Check your custom tool selector implementation',
                'Ensure it properly handles the state structure',
                'Add error handling to your selector function',
              ],
            });
          }
        } else {
          // Use the LLM to select the next tool
          stepLogger.debug('Using LLM to select next tool');

          // Format the prompt with current state and tools
          const stateSummary = createStateSummary(currentState);
          const toolsSummary = createToolsSummary(allTools);

          const prompt = customPrompt
            .replace('{query}', currentState.query)
            .replace('{tools}', toolsSummary)
            .replace('{state}', stateSummary);

          // Call the LLM to get the next tool decision
          try {
            const { object } = await executeWithRetry(
              async () => {
                return await generateObject({
                  model,
                  schema: toolSelectionSchema,
                  system:
                    'You are a research orchestration agent that selects the next best tool to use.',
                  prompt,
                  temperature: 0.3, // Lower temperature for more deterministic selection
                });
              },
              {
                maxRetries: retry.maxRetries,
                retryDelay: retry.baseDelay,
                backoffFactor: 2,
                onRetry: (attempt, error, delay) => {
                  stepLogger.warn(
                    `Retry attempt ${attempt} for tool selection: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying in ${delay}ms...`
                  );
                },
              }
            );

            chosenToolKey = object.tool;
            reasoning = object.reasoning;

            stepLogger.debug(`LLM selected tool: ${chosenToolKey} with reasoning: ${reasoning}`);
          } catch (llmError) {
            throw new LLMError({
              message: `Failed to get tool selection from LLM: ${llmError instanceof Error ? llmError.message : String(llmError)}`,
              step: 'Orchestration',
              details: { error: llmError },
              retry: true,
              suggestions: [
                'Check your LLM configuration',
                'Verify API key and model availability',
                'The LLM service might be experiencing issues, try again later',
              ],
            });
          }
        }

        // Check if we should finish (special 'finish' tool)
        if (chosenToolKey.toLowerCase() === 'finish') {
          stepLogger.info('Orchestration agent chose to finish the research process');

          // Record the finish decision
          const finishRecord: OrchestrationIteration = {
            iteration: iterationNumber,
            toolChosen: 'finish',
            reasoning,
            timestamp: new Date().toISOString(),
            result: 'Research process completed by agent decision',
          };

          currentState.data.orchestration.iterations.push(finishRecord);
          break; // Exit the orchestration loop
        }

        // Get the selected tool
        const chosenTool = allTools[chosenToolKey];

        if (!chosenTool) {
          stepLogger.warn(`Tool "${chosenToolKey}" not found in available tools`);

          toolErrors.push(
            new ConfigurationError({
              message: `Tool "${chosenToolKey}" not found in available tools`,
              step: 'Orchestration',
              details: {
                chosenTool: chosenToolKey,
                availableTools: Object.keys(allTools),
              },
              suggestions: [
                'Ensure the tool name matches a key in the tools object',
                'Check for typos in tool names',
                'Make sure all required tools are provided',
              ],
            })
          );

          if (!continueOnError) {
            throw toolErrors[toolErrors.length - 1];
          }

          // Record the error and continue to next iteration
          const errorRecord: OrchestrationIteration = {
            iteration: iterationNumber,
            toolChosen: chosenToolKey,
            reasoning,
            timestamp: new Date().toISOString(),
            error: `Tool "${chosenToolKey}" not found in available tools`,
          };

          currentState.data.orchestration.iterations.push(errorRecord);
          continue;
        }

        // Record the tool choice
        const iterationRecord: OrchestrationIteration = {
          iteration: iterationNumber,
          toolChosen: chosenToolKey,
          reasoning,
          timestamp: new Date().toISOString(),
        };

        currentState.data.orchestration.iterations.push(iterationRecord);
        stepLogger.debug(`Selected tool: ${chosenToolKey} (iteration ${iterationNumber})`);

        // Execute the chosen tool with error handling
        try {
          stepLogger.info(`Executing tool: ${chosenToolKey}`);
          // Save the previous state to compare for result summary
          const prevState = { ...currentState };

          // Execute the tool
          const nextState = await chosenTool.execute(currentState);

          // Get a summary of what changed
          const resultSummary = getToolResultSummary(nextState, prevState);

          // Preserve our orchestration data structure and update the iteration record
          currentState = {
            ...nextState,
            data: {
              ...nextState.data,
              orchestration: {
                ...currentState.data.orchestration,
              },
            },
          };

          // Update the iteration record with the result
          const currentIteration =
            currentState.data.orchestration.iterations[
              currentState.data.orchestration.iterations.length - 1
            ];
          currentIteration.result = resultSummary;

          stepLogger.debug(`Tool ${chosenToolKey} executed successfully: ${resultSummary}`);
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
                    iteration: iterationNumber,
                    error: toolError,
                  },
                  retry: false,
                })
          );

          // Update iteration record to include error
          const currentIteration =
            currentState.data.orchestration.iterations[
              currentState.data.orchestration.iterations.length - 1
            ];
          currentIteration.error = errorMessage;

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
          stepLogger.error(`Error in iteration ${iterationNumber}: ${errorMessage}`);
          stepLogger.warn(`Continuing to next iteration due to continueOnError=true`);

          // If it's not already in toolErrors, add it
          if (!toolErrors.some((err) => err.message === errorMessage)) {
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

    // Generate results based on the orchestration
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
      confidence: 0.8 * (successfulIterations / Math.max(1, totalIterations)),
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

    // Add the final result if requested
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
                reasoning: i.reasoning,
                timestamp: i.timestamp,
                result: i.result || null,
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
 * Creates an orchestration step that uses agents to make decisions
 *
 * This step uses an LLM to dynamically select and execute research tools based on the current state.
 * It can handle an entire research process from start to finish by adaptively choosing the right tools.
 *
 * @param options - Configuration for the orchestration
 * @param options.model - The language model to use for orchestration decisions (required)
 * @param options.searchProvider - Search provider for web searches (recommended)
 * @param options.tools - Optional map of custom tools to make available to the agent
 * @param options.customPrompt - Custom system prompt for the orchestration agent
 * @param options.maxIterations - Maximum number of tool executions to perform (default: 10)
 * @param options.exitCriteria - Optional function to determine when to exit orchestration
 * @param options.includeInResults - Whether to include orchestration results in output (default: true)
 * @param options.continueOnError - Whether to continue if a tool execution fails (default: false)
 * @param options.toolSelectorFn - Optional custom function for tool selection instead of using LLM
 * @param options.retry - Configuration for retry behavior
 *
 * @returns An orchestration step for the research pipeline
 *
 * @example
 * ```typescript
 * import { research, orchestrate } from '@plust/datasleuth';
 * import { openai } from '@ai-sdk/openai';
 * import { google } from '@plust/search-sdk';
 *
 * const results = await research({
 *   query: 'Impact of climate change on agriculture',
 *   outputSchema: schema,
 *   steps: [
 *     orchestrate({
 *       model: openai('gpt-4o'),
 *       searchProvider: google.configure({ apiKey: process.env.GOOGLE_API_KEY }),
 *       maxIterations: 15,
 *       continueOnError: true,
 *       exitCriteria: (state) => state.data.summary !== undefined
 *     })
 *   ]
 * });
 * ```
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
