/**
 * Utilities for creating and working with pipeline steps
 */
import { ResearchStep, ResearchState, StepOptions } from '../types/pipeline.js';
import { BaseResearchError, isResearchError } from '../types/errors.js';
import { logger, createStepLogger } from './logging.js';
import { executeWithRetry } from './retry.js';

/**
 * Step creation options with error handling configuration
 */
export interface StepCreationOptions {
  /** Whether the step can be retried on failure */
  retryable?: boolean;
  /** Whether the step can be skipped without breaking the pipeline */
  optional?: boolean;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay between retries in milliseconds */
  retryDelay?: number;
  /** Factor by which to increase the delay on each retry */
  backoffFactor?: number;
}

/**
 * Creates a new step with consistent structure and error handling
 *
 * @param name Name of the step
 * @param executor Function that executes the step logic
 * @param options Step options
 * @param creationOptions Error handling and retry configuration
 * @returns A research step with standardized error handling
 */
export function createStep<T extends StepOptions = StepOptions>(
  name: string,
  executor: (state: ResearchState, options: T) => Promise<ResearchState>,
  options: T = {} as T,
  creationOptions: StepCreationOptions = {}
): ResearchStep {
  const stepLogger = createStepLogger(name);

  // Create the step with standardized execution
  const step: ResearchStep = {
    name,
    options,
    retryable: creationOptions.retryable ?? false,
    optional: creationOptions.optional ?? false,

    async execute(state: ResearchState): Promise<ResearchState> {
      const startTime = Date.now();
      stepLogger.info(`Starting execution`);

      // Function that handles the actual execution
      const executeFunc = async (): Promise<ResearchState> => {
        try {
          // Update state to indicate current step
          const updatedState = {
            ...state,
            metadata: {
              ...state.metadata,
              currentStep: name,
            },
          };

          // Execute the step logic
          const result = await executor(updatedState, options);

          // Log success
          const duration = Date.now() - startTime;
          stepLogger.info(`Execution completed successfully in ${duration}ms`);

          return result;
        } catch (error: unknown) {
          // Transform error to a ResearchError if needed
          let researchError: BaseResearchError;

          if (isResearchError(error)) {
            researchError = error as BaseResearchError;
          } else if (error instanceof Error) {
            researchError = new BaseResearchError({
              message: error.message,
              code: 'step_execution_error',
              step: name,
              details: { originalError: error, stack: error.stack },
            });
          } else {
            researchError = new BaseResearchError({
              message: `Unknown error in step ${name}`,
              code: 'unknown_error',
              step: name,
              details: { originalError: error },
            });
          }

          // Log error
          const duration = Date.now() - startTime;
          stepLogger.error(
            `Execution failed in ${duration}ms: ${researchError.getFormattedMessage()}`
          );

          throw researchError;
        }
      };

      // If step is configured for retry, use the retry mechanism
      if (creationOptions.retryable && step.retryable) {
        return executeWithRetry(executeFunc, {
          maxRetries: creationOptions.maxRetries ?? 3,
          retryDelay: creationOptions.retryDelay ?? 1000,
          backoffFactor: creationOptions.backoffFactor ?? 2,
          onRetry: (attempt, error, delay) => {
            stepLogger.warn(
              `Retry attempt ${attempt} after error: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
                `Retrying in ${delay}ms...`
            );
          },
        });
      } else {
        return executeFunc();
      }
    },
  };

  return step;
}

/**
 * Wrap an existing step with enhanced error handling
 *
 * @param step The original step to wrap
 * @param creationOptions Error handling and retry configuration
 * @returns A wrapped step with enhanced error handling
 */
export function wrapStepWithErrorHandling(
  step: ResearchStep,
  creationOptions: StepCreationOptions = {}
): ResearchStep {
  const stepLogger = createStepLogger(step.name);

  // Create a new step that wraps the original
  const wrappedStep: ResearchStep = {
    name: step.name,
    options: step.options,
    retryable: creationOptions.retryable ?? step.retryable ?? false,
    optional: creationOptions.optional ?? step.optional ?? false,

    async execute(state: ResearchState): Promise<ResearchState> {
      const startTime = Date.now();
      stepLogger.info(`Starting execution of wrapped step`);

      // Function that executes the original step
      const executeFunc = async (): Promise<ResearchState> => {
        try {
          // Update state to indicate current step
          const updatedState = {
            ...state,
            metadata: {
              ...state.metadata,
              currentStep: step.name,
            },
          };

          // Execute the original step
          const result = await step.execute(updatedState);

          // Log success
          const duration = Date.now() - startTime;
          stepLogger.info(`Execution completed successfully in ${duration}ms`);

          return result;
        } catch (error: unknown) {
          // Transform error to a ResearchError if needed
          let researchError: BaseResearchError;

          if (isResearchError(error)) {
            researchError = error as BaseResearchError;
          } else if (error instanceof Error) {
            researchError = new BaseResearchError({
              message: error.message,
              code: 'step_execution_error',
              step: step.name,
              details: { originalError: error, stack: error.stack },
            });
          } else {
            researchError = new BaseResearchError({
              message: `Unknown error in step ${step.name}`,
              code: 'unknown_error',
              step: step.name,
              details: { originalError: error },
            });
          }

          // Log error
          const duration = Date.now() - startTime;
          stepLogger.error(
            `Execution failed in ${duration}ms: ${researchError.getFormattedMessage()}`
          );

          throw researchError;
        }
      };

      // If step is configured for retry, use the retry mechanism
      if (wrappedStep.retryable) {
        return executeWithRetry(executeFunc, {
          maxRetries: creationOptions.maxRetries ?? 3,
          retryDelay: creationOptions.retryDelay ?? 1000,
          backoffFactor: creationOptions.backoffFactor ?? 2,
          onRetry: (attempt, error, delay) => {
            stepLogger.warn(
              `Retry attempt ${attempt} after error: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
                `Retrying in ${delay}ms...`
            );
          },
        });
      } else {
        return executeFunc();
      }
    },

    // Include rollback if the original step had one
    rollback: step.rollback
      ? async (state: ResearchState): Promise<ResearchState> => {
          stepLogger.info(`Rolling back step`);
          try {
            // Safe call with null check
            if (step.rollback) {
              return await step.rollback(state);
            }
            // If rollback is undefined (shouldn't happen due to the check above), return state unchanged
            return state;
          } catch (error: unknown) {
            stepLogger.error(
              `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            throw error;
          }
        }
      : undefined,
  };

  return wrappedStep;
}
