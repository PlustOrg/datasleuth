/**
 * Utilities for creating and working with pipeline steps
 */
import { ResearchStep, ResearchState } from '../types/pipeline';

/**
 * Creates a standardized pipeline step
 * 
 * @param name Name of the step
 * @param executeFn Function that executes the step's logic
 * @param options Additional options for the step
 * @param rollbackFn Optional function to rollback the step's changes
 * @returns A properly structured ResearchStep
 */
export function createStep(
  name: string,
  executeFn: (state: ResearchState, options?: Record<string, any>) => Promise<ResearchState>,
  options: Record<string, any> = {},
  rollbackFn?: (state: ResearchState) => Promise<ResearchState>
): ResearchStep {
  return {
    name,
    options,
    execute: (state: ResearchState) => executeFn(state, options),
    rollback: rollbackFn,
  };
}

/**
 * Creates a composite step that executes multiple steps in sequence
 * 
 * @param name Name of the composite step
 * @param steps Array of steps to execute
 * @param options Additional options for the step
 * @returns A step that executes all provided steps in sequence
 */
export function createCompositeStep(
  name: string,
  steps: ResearchStep[],
  options: Record<string, any> = {}
): ResearchStep {
  return {
    name,
    options,
    execute: async (state: ResearchState) => {
      let currentState = { ...state };
      
      for (const step of steps) {
        currentState = await step.execute(currentState);
      }
      
      return currentState;
    },
    rollback: async (state: ResearchState) => {
      let currentState = { ...state };
      
      // Rollback steps in reverse order
      for (const step of [...steps].reverse()) {
        if (step.rollback) {
          currentState = await step.rollback(currentState);
        }
      }
      
      return currentState;
    },
  };
}