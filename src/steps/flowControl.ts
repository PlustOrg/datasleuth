/**
 * Flow control utilities for the research pipeline
 * Implements conditional iteration and evaluation steps
 */
import { createStep, createCompositeStep } from '../utils/steps';
import { ResearchState, ResearchStep } from '../types/pipeline';

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
}

/**
 * Evaluates the current state against specified criteria
 */
async function executeEvaluateStep(
  state: ResearchState,
  options: EvaluateOptions
): Promise<ResearchState> {
  const {
    criteriaFn,
    criteriaName = 'CustomEvaluation',
    confidenceThreshold = 0.7,
    storeResult = true,
  } = options;

  // Execute the criteria function
  const result = await criteriaFn(state);
  
  // Calculate confidence score - this is simplified for now
  const confidenceScore = result ? 0.8 : 0.3;
  
  // Store results in state if requested
  if (storeResult) {
    return {
      ...state,
      data: {
        ...state.data,
        evaluations: {
          ...(state.data.evaluations || {}),
          [criteriaName]: {
            passed: result,
            confidenceScore,
            timestamp: new Date().toISOString(),
          },
        },
      },
      metadata: {
        ...state.metadata,
        confidenceScore: Math.max(
          state.metadata.confidenceScore || 0,
          confidenceScore
        ),
      },
    };
  }

  return state;
}

/**
 * Creates a conditional evaluation step
 */
export function evaluate(options: EvaluateOptions): ReturnType<typeof createStep> {
  return createStep('Evaluate', executeEvaluateStep, options);
}

/**
 * Options for the repeatUntil step
 */
export interface RepeatUntilOptions {
  /** Maximum number of iterations */
  maxIterations?: number;
  /** Whether to throw an error if max iterations is reached */
  throwOnMaxIterations?: boolean;
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
  } = options;

  // Create the repeating step
  return createStep(
    'RepeatUntil',
    async (state: ResearchState): Promise<ResearchState> => {
      let currentState = { ...state };
      let iterations = 0;
      let conditionMet = false;

      // Execute steps until condition is met or max iterations reached
      while (iterations < maxIterations && !conditionMet) {
        iterations += 1;
        console.log(`RepeatUntil iteration ${iterations}/${maxIterations}`);

        // Execute the condition step
        const conditionState = await conditionStep.execute(currentState);
        
        // Check if condition is met by checking evaluations in state
        const evaluationKey = Object.keys(conditionState.data.evaluations || {}).pop();
        if (evaluationKey && conditionState.data.evaluations[evaluationKey].passed) {
          conditionMet = true;
          currentState = conditionState;
          break;
        }

        // Execute the steps to repeat
        for (const step of stepsToRepeat) {
          currentState = await step.execute(conditionState);
        }
      }

      // Check if we hit max iterations without meeting condition
      if (!conditionMet && throwOnMaxIterations) {
        throw new Error(`Maximum iterations (${maxIterations}) reached without meeting condition`);
      }

      // Update state with iteration information
      return {
        ...currentState,
        data: {
          ...currentState.data,
          iterations: {
            ...(currentState.data.iterations || {}),
            [conditionStep.name]: {
              completed: iterations,
              conditionMet,
              maxReached: iterations >= maxIterations,
            },
          },
        },
      };
    },
    options
  );
}