/**
 * Core pipeline execution engine
 */

import { 
  ResearchState, 
  ResearchStep, 
  PipelineConfig, 
  StepExecutionRecord,
  ResearchResult
} from '../types/pipeline';
import { z } from 'zod';

/**
 * Default pipeline configuration
 */
const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  steps: [],
  errorHandling: 'stop',
  maxRetries: 3,
  timeout: 300000, // 5 minutes
};

/**
 * Creates a new research state
 */
export function createInitialState(query: string, outputSchema: z.ZodType<ResearchResult>): ResearchState {
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
  error?: Error,
  metadata?: Record<string, any>
): ResearchState {
  const record: StepExecutionRecord = {
    stepName: step.name,
    startTime: new Date(),
    endTime: new Date(),
    success,
    error,
    metadata,
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
 * Executes a single step with retry logic
 */
async function executeStepWithRetry(
  step: ResearchStep,
  state: ResearchState,
  maxRetries: number
): Promise<ResearchState> {
  let retries = 0;
  let currentState = state;
  let error: Error | undefined;

  while (retries <= maxRetries) {
    try {
      console.log(`Executing step: ${step.name}`);
      const updatedState = await step.execute(currentState);
      return recordStepExecution(updatedState, step, true);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      console.error(`Error in step ${step.name}, attempt ${retries + 1}/${maxRetries + 1}:`, error);
      retries++;
      
      if (retries <= maxRetries) {
        // Wait before retrying (exponential backoff)
        const backoffTime = Math.min(1000 * Math.pow(2, retries - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  // All retries failed
  return recordStepExecution(currentState, step, false, error);
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
  let state = initialState;

  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Pipeline execution timed out after ${fullConfig.timeout}ms`)), 
      fullConfig.timeout);
  });

  // Execute the pipeline with timeout
  try {
    const executionPromise = executeSteps(state, fullConfig);
    state = await Promise.race([executionPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof Error) {
      state.errors.push(error);
    } else {
      state.errors.push(new Error(String(error)));
    }
  } finally {
    state.metadata.endTime = new Date();
  }

  return state;
}

/**
 * Execute pipeline steps sequentially
 */
async function executeSteps(
  initialState: ResearchState,
  config: PipelineConfig
): Promise<ResearchState> {
  let state = initialState;
  const { steps, errorHandling, maxRetries } = config;

  for (const step of steps) {
    const updatedState = await executeStepWithRetry(step, state, maxRetries!);
    state = updatedState;

    // Check for errors and handle according to strategy
    const latestExecution = state.metadata.stepHistory[state.metadata.stepHistory.length - 1];
    
    if (!latestExecution.success) {
      if (errorHandling === 'stop') {
        break;
      } else if (errorHandling === 'rollback' && step.rollback) {
        try {
          state = await step.rollback(state);
        } catch (rollbackError) {
          console.error(`Rollback for step ${step.name} failed:`, rollbackError);
          state.errors.push(
            rollbackError instanceof Error 
              ? rollbackError 
              : new Error(`Rollback for step ${step.name} failed: ${String(rollbackError)}`)
          );
        }
        break;
      }
      // 'continue' strategy just moves to the next step
    }
  }

  return state;
}