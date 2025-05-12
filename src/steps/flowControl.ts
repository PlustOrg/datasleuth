/**
 * Flow control utilities for the research pipeline
 * Implements conditional iteration and evaluation steps
 */
import { createStep } from '../utils/steps.js';
import { ResearchState, ResearchStep } from '../types/pipeline.js';
import {
  ValidationError,
  ConfigurationError,
  ProcessingError,
  MaxIterationsError,
} from '../types/errors.js';
import { logger, createStepLogger } from '../utils/logging.js';

/**
 * Options for the evaluate step
 */
export interface EvaluateOptions {
  /** Criteria function that determines if evaluation passes */
  criteriaFn: (state: ResearchState) => boolean | Promise<boolean>;
  /** Name for this evaluation criteria (used in logs) */
  criteriaName?: string;
  /** Confidence threshold (0.0 to 1.0) */
  confidenceThreshold?: number;
  /** Whether to store evaluation result in state metadata */
  storeResult?: boolean;
  /** Retry configuration */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Evaluates the current state against specified criteria
 */
async function executeEvaluateStep(
  state: ResearchState,
  options: EvaluateOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Evaluate');

  const {
    criteriaFn,
    criteriaName = 'CustomEvaluation',
    confidenceThreshold = 0.7,
    storeResult = true,
    retry = { maxRetries: 2, baseDelay: 1000 },
  } = options;

  try {
    // Validate inputs
    if (!criteriaFn || typeof criteriaFn !== 'function') {
      throw new ValidationError({
        message: 'No criteria function provided for evaluation',
        step: 'Evaluate',
        details: { options },
        suggestions: [
          'Provide a function that returns a boolean or Promise<boolean>',
          'Example: evaluate({ criteriaFn: (state) => state.data.searchResults.length > 5 })',
        ],
      });
    }

    if (confidenceThreshold < 0 || confidenceThreshold > 1) {
      throw new ValidationError({
        message: `Invalid confidence threshold: ${confidenceThreshold}. Must be between 0 and 1.`,
        step: 'Evaluate',
        details: { confidenceThreshold },
        suggestions: [
          'Confidence threshold must be between 0.0 and 1.0',
          'Recommended values are between 0.5 and 0.9',
        ],
      });
    }

    stepLogger.info(`Evaluating criteria: ${criteriaName}`);

    // Execute the criteria function
    let result: boolean;
    try {
      result = await criteriaFn(state);
      if (typeof result !== 'boolean') {
        throw new ValidationError({
          message: `Criteria function must return a boolean value, got ${typeof result}`,
          step: 'Evaluate',
          details: {
            returnValue: result,
            returnType: typeof result,
          },
          suggestions: [
            'Ensure your criteriaFn returns a boolean (true/false) value',
            'Convert non-boolean results to boolean using !!value',
          ],
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stepLogger.error(`Error executing criteria function: ${errorMessage}`);

      throw new ProcessingError({
        message: `Failed to execute evaluation criteria "${criteriaName}": ${errorMessage}`,
        step: 'Evaluate',
        details: {
          criteriaName,
          error,
        },
        retry: true,
        suggestions: [
          'Check your criteriaFn implementation for errors',
          'Ensure criteriaFn properly handles the state structure',
          'Add error handling inside your criteriaFn',
        ],
      });
    }

    // Calculate confidence score based on threshold and result
    // This produces higher confidence when criteria passes, scaled by threshold
    const confidenceScore = result
      ? 0.5 + confidenceThreshold * 0.5
      : 0.5 - confidenceThreshold * 0.5;

    stepLogger.info(
      `Evaluation "${criteriaName}" ${result ? 'passed' : 'failed'} with confidence ${confidenceScore.toFixed(2)}`
    );

    // Store results in state if requested
    if (storeResult) {
      const evaluationResult = {
        passed: result,
        confidenceScore,
        timestamp: new Date().toISOString(),
        criteria: criteriaName,
      };

      return {
        ...state,
        data: {
          ...state.data,
          evaluations: {
            ...(state.data.evaluations || {}),
            [criteriaName]: evaluationResult, // Store only the properly typed object
          },
        },
        metadata: {
          ...state.metadata,
          lastEvaluation: criteriaName,
          lastEvaluationResult: result,
          confidenceScore: Math.max(state.metadata.confidenceScore || 0, confidenceScore),
        },
      };
    }

    return state;
  } catch (error: unknown) {
    // If it's already one of our error types, just rethrow
    if (
      error instanceof ValidationError ||
      error instanceof ConfigurationError ||
      error instanceof ProcessingError
    ) {
      throw error;
    }

    // Otherwise wrap in a ProcessingError
    const errorMessage = error instanceof Error ? error.message : String(error);
    stepLogger.error(`Evaluation error: ${errorMessage}`);

    throw new ProcessingError({
      message: `Evaluation "${criteriaName}" failed: ${errorMessage}`,
      step: 'Evaluate',
      details: { error, criteriaName },
      retry: true,
      suggestions: [
        'Check the implementation of your criteria function',
        'Verify that the state contains the expected data structure',
        'Add defensive checks in your criteria function to handle missing data',
      ],
    });
  }
}

/**
 * Creates an evaluation step for the research pipeline
 *
 * @param options Configuration options for evaluation
 * @returns An evaluation step for the research pipeline
 */
export function evaluate(options: EvaluateOptions): ReturnType<typeof createStep> {
  return createStep(
    'Evaluate',
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeEvaluateStep(state, options);
    },
    options
  );
}

/**
 * Options for the repeatUntil step
 */
export interface RepeatUntilOptions {
  /** Maximum number of iterations */
  maxIterations?: number;
  /** Whether to throw an error if max iterations is reached */
  throwOnMaxIterations?: boolean;
  /** Whether to continue if a step fails during iteration */
  continueOnError?: boolean;
  /** Retry configuration */
  retry?: {
    /** Maximum number of retries for the whole RepeatUntil step */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Creates a composite step that repeats the given steps until a condition is met
 *
 * @param conditionStep Step that evaluates whether to continue repeating
 * @param stepsToRepeat Array of steps to repeat until condition is met
 * @param options Configuration options
 * @returns A composite step that handles the iteration
 */
export function repeatUntil(
  conditionStep: ResearchStep,
  stepsToRepeat: ResearchStep[],
  options: RepeatUntilOptions = {}
): ReturnType<typeof createStep> {
  const {
    maxIterations = 5,
    throwOnMaxIterations = false,
    continueOnError = false,
    retry = { maxRetries: 1, baseDelay: 1000 },
  } = options;

  // Validate inputs before returning step
  if (!conditionStep || typeof conditionStep.execute !== 'function') {
    throw new ValidationError({
      message: 'Invalid condition step provided to repeatUntil',
      step: 'RepeatUntil',
      details: { conditionStep },
      suggestions: [
        'Condition step must be created using evaluate() or another step factory',
        'Example: repeatUntil(evaluate({ criteriaFn: ... }), [step1, step2])',
      ],
    });
  }

  if (!stepsToRepeat || !Array.isArray(stepsToRepeat) || stepsToRepeat.length === 0) {
    throw new ValidationError({
      message: 'No steps to repeat provided to repeatUntil',
      step: 'RepeatUntil',
      details: { stepsToRepeat },
      suggestions: [
        'Provide at least one step to repeat',
        'Example: repeatUntil(condition, [searchWeb(), extractContent()])',
      ],
    });
  }

  if (maxIterations <= 0) {
    throw new ValidationError({
      message: `Invalid maxIterations value: ${maxIterations}. Must be greater than 0.`,
      step: 'RepeatUntil',
      details: { maxIterations },
      suggestions: ['Provide a positive integer for maxIterations', 'Default is 5 iterations'],
    });
  }

  // Create the repeating step
  return createStep(
    'RepeatUntil',
    async (state: ResearchState): Promise<ResearchState> => {
      const stepLogger = createStepLogger('RepeatUntil');

      try {
        let currentState = { ...state };
        let iterations = 0;
        let conditionMet = false;
        const iterationErrors: Error[] = [];

        stepLogger.info(`Starting repeatUntil loop with max ${maxIterations} iterations`);

        // Execute steps until condition is met or max iterations reached
        while (iterations < maxIterations && !conditionMet) {
          iterations += 1;
          stepLogger.info(`Executing iteration ${iterations}/${maxIterations}`);

          try {
            // Execute the condition step
            stepLogger.debug(`Evaluating condition (${conditionStep.name})`);
            const conditionState = await conditionStep.execute(currentState);

            // Check if condition is met by checking evaluations in state
            const evaluations = conditionState.data.evaluations || {};
            const evaluationKeys = Object.keys(evaluations);

            // Try to find the most recent evaluation
            const evaluationKey =
              evaluationKeys.length > 0 ? evaluationKeys[evaluationKeys.length - 1] : null;

            if (evaluationKey) {
              // Get the evaluation result, which should now always be an EvaluationResult object
              const evaluation = evaluations[evaluationKey];

              // Check the passed property to determine if condition is met
              if (
                evaluation &&
                typeof evaluation === 'object' &&
                'passed' in evaluation &&
                evaluation.passed
              ) {
                conditionMet = true;
                currentState = conditionState;
                stepLogger.info(`Condition met in iteration ${iterations}, exiting loop`);
                break;
              }
            }

            stepLogger.debug(
              `Condition not met, executing ${stepsToRepeat.length} steps in iteration ${iterations}`
            );

            // Execute the steps to repeat
            for (const step of stepsToRepeat) {
              try {
                stepLogger.debug(`Executing step ${step.name} in iteration ${iterations}`);
                currentState = await step.execute(conditionState);
              } catch (stepError: unknown) {
                const errorMessage =
                  stepError instanceof Error ? stepError.message : String(stepError);
                stepLogger.error(
                  `Error in step ${step.name} during iteration ${iterations}: ${errorMessage}`
                );

                // Add to iteration errors
                iterationErrors.push(
                  stepError instanceof Error ? stepError : new Error(errorMessage)
                );

                // If we should not continue on error, rethrow
                if (!continueOnError) {
                  throw new ProcessingError({
                    message: `Step ${step.name} failed during iteration ${iterations}: ${errorMessage}`,
                    step: 'RepeatUntil',
                    details: {
                      iteration: iterations,
                      step: step.name,
                      originalError: stepError,
                    },
                    retry: false,
                    suggestions: [
                      'Set continueOnError=true to continue despite step failures',
                      'Check the specific step for configuration errors',
                      'Examine the original error for more details',
                    ],
                  });
                }

                // Otherwise log and continue with next step
                stepLogger.warn(
                  `Continuing with next step after error due to continueOnError=true`
                );
              }
            }
          } catch (iterationError: unknown) {
            const errorMessage =
              iterationError instanceof Error ? iterationError.message : String(iterationError);
            stepLogger.error(`Error during iteration ${iterations}: ${errorMessage}`);

            // Add to iteration errors
            iterationErrors.push(
              iterationError instanceof Error ? iterationError : new Error(errorMessage)
            );

            // If we should not continue on error, rethrow
            if (!continueOnError) {
              throw iterationError;
            }

            // Otherwise log and continue with next iteration
            stepLogger.warn(
              `Continuing with next iteration after error due to continueOnError=true`
            );
          }
        }

        // Check if we hit max iterations without meeting condition
        if (!conditionMet) {
          const maxIterationsMessage = `Maximum iterations (${maxIterations}) reached without meeting condition`;
          stepLogger.warn(maxIterationsMessage);

          if (throwOnMaxIterations) {
            throw new MaxIterationsError({
              message: maxIterationsMessage,
              step: 'RepeatUntil',
              details: {
                maxIterations,
                completedIterations: iterations,
                conditionStepName: conditionStep.name,
              },
              retry: false,
              suggestions: [
                'Increase maxIterations',
                'Adjust your condition to be less strict',
                'Set throwOnMaxIterations=false to continue without error',
              ],
            });
          }
        }

        // Update state with iteration information
        const finalState = {
          ...currentState,
          data: {
            ...currentState.data,
            iterations: {
              ...(currentState.data.iterations || {}),
              [conditionStep.name]: {
                completed: iterations,
                conditionMet,
                maxReached: iterations >= maxIterations,
                iterationErrors: iterationErrors.length > 0,
                errorCount: iterationErrors.length,
              },
            },
          },
          metadata: {
            ...currentState.metadata,
            repeatUntilComplete: true,
            repeatUntilConditionMet: conditionMet,
            repeatUntilIterations: iterations,
          },
          // Add any iteration errors to the state errors
          errors: [...currentState.errors, ...iterationErrors],
        };

        stepLogger.info(
          `RepeatUntil complete after ${iterations} iterations, condition met: ${conditionMet}`
        );
        return finalState;
      } catch (error: unknown) {
        // Handle already typed errors
        if (
          error instanceof ValidationError ||
          error instanceof ConfigurationError ||
          error instanceof ProcessingError ||
          error instanceof MaxIterationsError
        ) {
          throw error;
        }

        // Otherwise wrap in ProcessingError
        const errorMessage = error instanceof Error ? error.message : String(error);
        stepLogger.error(`RepeatUntil execution failed: ${errorMessage}`);

        throw new ProcessingError({
          message: `RepeatUntil execution failed: ${errorMessage}`,
          step: 'RepeatUntil',
          details: {
            error,
            conditionStepName: conditionStep.name,
            repeatingSteps: stepsToRepeat.map((s) => s.name),
          },
          retry: false,
          suggestions: [
            'Check the condition step implementation',
            'Verify the steps to repeat are properly configured',
            'Consider setting continueOnError=true to handle step failures',
          ],
        });
      }
    },
    options,
    {
      // Add retry configuration
      retryable: true,
      maxRetries: retry.maxRetries || 1,
      retryDelay: retry.baseDelay || 1000,
      backoffFactor: 2,
    }
  );
}
