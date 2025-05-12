/**
 * Core pipeline execution engine
 *
 * This module provides the infrastructure for executing research pipelines.
 * It handles step execution, error management, retries, timeouts, and state management
 * throughout the research process.
 *
 * @module core/pipeline
 */

import {
  ResearchState,
  ResearchStep,
  PipelineConfig,
  StepExecutionRecord,
  ResearchResult,
} from '../types/pipeline.js';
import { z } from 'zod';
import { logger, createStepLogger } from '../utils/logging.js';
import { executeWithRetry } from '../utils/retry.js';
import {
  BaseResearchError,
  PipelineError,
  ConfigurationError,
  isResearchError,
} from '../types/errors.js';

/**
 * Default pipeline configuration
 */
const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  steps: [],
  errorHandling: 'stop',
  maxRetries: 3,
  retryDelay: 1000,
  backoffFactor: 2,
  continueOnError: false,
  timeout: 300000, // 5 minutes
  logLevel: 'info',
};

/**
 * Creates the initial state object for a research pipeline
 *
 * @param query - The research query string
 * @param outputSchema - A Zod schema that defines the expected output structure
 * @returns A fresh ResearchState object initialized with the provided query and schema
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { createInitialState } from '@plust/datasleuth';
 *
 * const outputSchema = z.object({
 *   summary: z.string(),
 *   findings: z.array(z.string())
 * });
 *
 * const initialState = createInitialState(
 *   "What are the latest advancements in renewable energy?",
 *   outputSchema
 * );
 * ```
 */
export function createInitialState(
  query: string,
  outputSchema: z.ZodType<ResearchResult>
): ResearchState {
  return {
    query,
    outputSchema,
    data: {},
    results: [],
    errors: [],
    metadata: {
      startTime: new Date(),
      stepHistory: [],
      confidenceScore: 0,
    },
  };
}

/**
 * Records the execution of a step
 */
function recordStepExecution(
  state: ResearchState,
  step: ResearchStep,
  success: boolean,
  error?: Error | BaseResearchError,
  duration?: number,
  metadata?: Record<string, any>
): ResearchState {
  const startTime = new Date(Date.now() - (duration || 0));
  const endTime = new Date();

  const record: StepExecutionRecord = {
    stepName: step.name,
    startTime,
    endTime,
    success,
    error,
    metadata: {
      ...metadata,
      duration: duration || endTime.getTime() - startTime.getTime(),
    },
  };

  return {
    ...state,
    metadata: {
      ...state.metadata,
      stepHistory: [...state.metadata.stepHistory, record],
    },
    errors: error ? [...state.errors, error] : state.errors,
  };
}

/**
 * Executes a single step with enhanced error handling and retry logic
 */
async function executeStepWithErrorHandling(
  step: ResearchStep,
  state: ResearchState,
  config: PipelineConfig
): Promise<ResearchState> {
  const stepLogger = createStepLogger(step.name);
  let startTime: number;

  // Define the execution function
  const executeStep = async (): Promise<ResearchState> => {
    startTime = Date.now();
    stepLogger.info(`Starting execution`);

    try {
      // Execute the step
      const updatedState = await step.execute(state);

      // Record success
      const duration = Date.now() - startTime;
      stepLogger.info(`Execution completed successfully in ${duration}ms`);

      return recordStepExecution(updatedState, step, true, undefined, duration);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      // Transform errors into ResearchError if needed
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

      // Log the error
      stepLogger.error(`Execution failed in ${duration}ms: ${researchError.getFormattedMessage()}`);

      // Add error to state and mark as failed
      return recordStepExecution(state, step, false, researchError, duration);
    }
  };

  // Execute with retry if step is marked as retryable
  if (step.retryable && config.maxRetries && config.maxRetries > 0) {
    stepLogger.debug(`Step is retryable, will retry up to ${config.maxRetries} times if needed`);

    try {
      return await executeWithRetry(executeStep, {
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay || 1000,
        backoffFactor: config.backoffFactor || 2,
        onRetry: (attempt, error, delay) => {
          stepLogger.warn(
            `Retry attempt ${attempt}/${config.maxRetries} after error: ` +
              `${error instanceof Error ? error.message : 'Unknown error'}. ` +
              `Retrying in ${delay}ms...`
          );
        },
      });
    } catch (error) {
      // If all retries failed, we'll get here
      stepLogger.error(`All ${config.maxRetries} retry attempts failed`);

      // The error has already been transformed by executeStep
      // Just return the state from the last attempt
      return state;
    }
  } else {
    // No retry, just execute once
    return executeStep();
  }
}

/**
 * Main pipeline execution function
 */
export async function executePipeline(
  initialState: ResearchState,
  steps: ResearchStep[],
  config: Partial<PipelineConfig> = {}
): Promise<ResearchState> {
  const fullConfig: PipelineConfig = { ...DEFAULT_PIPELINE_CONFIG, ...config, steps };

  // Configure logger based on pipeline config
  logger.setLogLevel(fullConfig.logLevel || 'info');

  // Initialize state and add start time
  let state: ResearchState = {
    ...initialState,
    metadata: {
      ...initialState.metadata,
      startTime: new Date(),
      pipelineConfig: fullConfig,
    },
  };

  logger.info(`Starting pipeline execution with ${steps.length} steps`);

  // Create a timeout promise with handle for cleanup
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new PipelineError({
        message: `Pipeline execution timed out after ${fullConfig.timeout}ms`,
        step: 'pipeline',
      });
      reject(error);
    }, fullConfig.timeout || DEFAULT_PIPELINE_CONFIG.timeout);
  });

  // Execute the pipeline with timeout
  try {
    const executionPromise = executeSteps(state, fullConfig);
    state = await Promise.race([executionPromise, timeoutPromise]);

    logger.info(`Pipeline execution completed successfully`);
  } catch (error) {
    logger.error(
      `Pipeline execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    // Transform error to ResearchError if needed
    const researchError = isResearchError(error)
      ? (error as BaseResearchError)
      : new PipelineError({
          message: error instanceof Error ? error.message : String(error),
          step: 'pipeline',
        });

    state.errors.push(researchError);
  } finally {
    // Always clear the timeout to prevent memory leaks
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    // Always update end time
    state.metadata.endTime = new Date();

    // Calculate total duration
    const duration = state.metadata.endTime.getTime() - state.metadata.startTime.getTime();
    logger.info(`Pipeline execution finished in ${duration}ms`);
  }

  return state;
}

/**
 * Execute pipeline steps sequentially with enhanced error handling
 */
async function executeSteps(
  initialState: ResearchState,
  config: PipelineConfig
): Promise<ResearchState> {
  let state = initialState;
  const { steps, errorHandling, continueOnError } = config;

  for (const step of steps) {
    // Execute the step with error handling
    const updatedState = await executeStepWithErrorHandling(step, state, config);
    state = updatedState;

    // Check for errors and handle according to strategy
    const latestExecution = state.metadata.stepHistory[state.metadata.stepHistory.length - 1];

    if (!latestExecution.success) {
      logger.warn(`Step "${step.name}" failed`);

      if (errorHandling === 'stop' && !continueOnError) {
        logger.info(
          `Stopping pipeline execution due to error in step "${step.name}" (errorHandling: 'stop')`
        );
        break;
      } else if (errorHandling === 'rollback' && step.rollback) {
        logger.info(`Rolling back step "${step.name}"`);
        try {
          state = await step.rollback(state);
          logger.info(`Rollback for step "${step.name}" successful`);
        } catch (rollbackError) {
          logger.error(
            `Rollback for step "${step.name}" failed: ${
              rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
            }`
          );

          // Transform error to ResearchError if needed
          const researchError = isResearchError(rollbackError)
            ? rollbackError
            : new PipelineError({
                message: `Rollback for step "${step.name}" failed: ${
                  rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
                }`,
                step: step.name,
              });

          state.errors.push(researchError);
        }

        if (!continueOnError) {
          logger.info(`Stopping pipeline execution after rollback (errorHandling: 'rollback')`);
          break;
        }
      }
      // For 'continue' strategy or if continueOnError is true, move to the next step
    }
  }

  return state;
}
