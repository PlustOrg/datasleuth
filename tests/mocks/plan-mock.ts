// filepath: /Users/jacquesmarais/Documents/Personal/deep-research-api/packages/core/tests/mocks/plan-mock.ts
/**
 * Mock implementation of the plan step for testing
 * This version doesn't rely on LLMs or the AI SDK
 */
import { createStep } from '../../src/utils/steps';
import { ResearchState, ResearchData } from '../../src/types/pipeline';
import { ConfigurationError, LLMError } from '../../src/types/errors';
import { logger, createStepLogger } from '../../src/utils/logging';

// Use proper type definition based on ResearchData interface
export type ResearchPlan = Record<string, string | string[]>;

/**
 * Mock options for the planning step
 */
export interface MockPlanOptions {
  /** Whether to include the research plan in the final results */
  includeInResults?: boolean;
  /** Whether this mock should throw an error (for testing error handling) */
  shouldError?: boolean;
  /** Custom error message when shouldError is true */
  errorMessage?: string;
  /** Predefined mock plan to return (otherwise uses default mock plan) */
  mockPlan?: ResearchPlan;
}

// Default mock research plan for testing
const DEFAULT_MOCK_PLAN: ResearchPlan = {
  objectives: ["Objective 1", "Objective 2"],
  searchQueries: ["Query 1", "Query 2"],
  relevantFactors: ["Factor 1", "Factor 2"],
  dataGatheringStrategy: "Test gathering strategy",
  expectedFindings: ["Expected finding 1", "Expected finding 2"],
  expectedOutcomes: ["Expected outcome 1", "Expected outcome 2"]
};

/**
 * Creates a mock research plan for testing
 */
async function executeMockPlanStep(
  state: ResearchState,
  options: MockPlanOptions = {}
): Promise<ResearchState> {
  const stepLogger = createStepLogger('ResearchPlanning');
  
  const {
    includeInResults = true,
    shouldError = false,
    errorMessage = 'Mock LLM failure',
    mockPlan = DEFAULT_MOCK_PLAN
  } = options;

  stepLogger.info('Starting mock research plan generation');

  try {
    // If shouldError is true, throw an error (for testing error handling)
    if (shouldError) {
      throw new LLMError({
        message: errorMessage,
        step: 'ResearchPlanning',
        details: { options },
        retry: true,
        suggestions: [
          "This is a mock error for testing",
          "No real LLM is being used"
        ]
      });
    }
    
    const startTime = Date.now();
    
    // Use the provided mock plan or the default one
    const researchPlan = mockPlan;
    
    const timeTaken = Date.now() - startTime;
    stepLogger.info(`Mock research plan generated successfully in ${timeTaken}ms`);

    // Store the plan in state for later steps to use
    const newState = {
      ...state,
      data: {
        ...state.data,
        researchPlan,
        plan: researchPlan, // Some tests might be looking for this property
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
    // Just re-throw the error for test assertions to catch
    throw error;
  }
}

/**
 * Creates a mock planning step for testing
 * 
 * @param options Configuration options for the mock planning step
 * @returns A mock planning step for testing
 */
export function mockPlan(options: MockPlanOptions = {}): ReturnType<typeof createStep> {
  return createStep(
    'ResearchPlanning', 
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeMockPlanStep(state, options);
    }, 
    options
  );
}