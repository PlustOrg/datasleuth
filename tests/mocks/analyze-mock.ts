// filepath: /Users/jacquesmarais/Documents/Personal/deep-research-api/packages/core/tests/mocks/analyze-mock.ts
/**
 * Mock implementation of the analyze step for testing
 * This version doesn't rely on LLMs or the AI SDK
 */
import { createStep } from '../../src/utils/steps';
import { ResearchState, AnalysisResult } from '../../src/types/pipeline';
import { ConfigurationError, LLMError, ValidationError } from '../../src/types/errors';
import { logger, createStepLogger } from '../../src/utils/logging';

/**
 * Mock options for the analyze step
 */
export interface MockAnalyzeOptions {
  /** Focus area for the analysis */
  focus: string;
  /** Depth of analysis: basic, standard, or detailed */
  depth?: 'basic' | 'standard' | 'detailed';
  /** Whether to include recommendations in the analysis */
  includeRecommendations?: boolean;
  /** Whether to include analysis in the final results */
  includeInResults?: boolean;
  /** Whether to throw an error if no content is available */
  allowEmptyContent?: boolean;
  /** Custom prompt for analysis (not used in mock, but included for API compatibility) */
  customPrompt?: string;
  /** Whether this mock should throw an error (for testing error handling) */
  shouldError?: boolean;
  /** Custom error message when shouldError is true */
  errorMessage?: string;
  /** Predefined mock analysis to return (otherwise uses default mock analysis) */
  mockAnalysis?: AnalysisResult;
}

// Default mock analysis result for testing
const DEFAULT_MOCK_ANALYSIS: AnalysisResult = {
  focus: 'general',
  insights: ['Key insight 1', 'Key insight 2'],
  confidence: 0.9,
  supportingEvidence: ['Evidence 1', 'Evidence 2'],
  recommendations: ['Recommendation 1', 'Recommendation 2']
};

/**
 * Creates a mock analysis for testing
 */
async function executeMockAnalyzeStep(
  state: ResearchState,
  options: MockAnalyzeOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Analysis');
  
  const {
    focus,
    depth = 'standard',
    includeRecommendations = true,
    includeInResults = false,
    allowEmptyContent = false,
    shouldError = false,
    errorMessage = 'Mock analysis failure',
    mockAnalysis = DEFAULT_MOCK_ANALYSIS
  } = options;

  stepLogger.info(`Starting mock analysis with focus: ${focus}, depth: ${depth}`);

  try {
    // If shouldError is true, throw an error (for testing error handling)
    if (shouldError) {
      throw new LLMError({
        message: errorMessage,
        step: 'Analysis',
        details: { options },
        retry: true,
        suggestions: [
          "This is a mock error for testing",
          "No real LLM is being used"
        ]
      });
    }
    
    // Check if there's content to analyze
    if (!state.data.extractedContent || state.data.extractedContent.length === 0) {
      if (!allowEmptyContent) {
        throw new ValidationError({
          message: 'No content available for analysis',
          step: 'Analysis',
          details: { options },
          suggestions: [
            "Ensure the content extraction step has been executed",
            "Check that the search results returned valid content",
            "Use allowEmptyContent: true to continue even with no content"
          ]
        });
      }
      
      // If empty content is allowed, just return the state unchanged
      stepLogger.warn('No content available for analysis, skipping (allowEmptyContent=true)');
      return state;
    }
    
    const startTime = Date.now();
    
    // Use the provided mock analysis or the default one, with focus set to the provided focus
    const analysis: AnalysisResult = {
      ...mockAnalysis,
      focus: focus,
      // Adjust insights based on depth
      insights: depth === 'basic' 
        ? mockAnalysis.insights.slice(0, 1) 
        : depth === 'detailed' 
          ? [...mockAnalysis.insights, 'Additional detailed insight'] 
          : mockAnalysis.insights,
      // Include or exclude recommendations based on includeRecommendations
      recommendations: includeRecommendations 
        ? mockAnalysis.recommendations 
        : undefined
    };
    
    const timeTaken = Date.now() - startTime;
    stepLogger.info(`Mock analysis generated successfully in ${timeTaken}ms`);

    // Store the analysis in state
    const newState = {
      ...state,
      data: {
        ...state.data,
        analysis: {
          ...state.data.analysis,
          [focus]: analysis
        }
      },
      metadata: {
        ...state.metadata,
        analysisTimeMs: timeTaken
      }
    };

    // Add the analysis to results if requested
    if (includeInResults) {
      return {
        ...newState,
        results: [...newState.results, { analysis: { [focus]: analysis } }],
      };
    }

    return newState;
  } catch (error: unknown) {
    // Just re-throw the error for test assertions to catch
    throw error;
  }
}

/**
 * Creates a mock analyze step for testing
 * 
 * @param options Configuration options for the mock analyze step
 * @returns A mock analyze step for testing
 */
export function mockAnalyze(options: MockAnalyzeOptions): ReturnType<typeof createStep> {
  return createStep(
    'Analysis', 
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeMockAnalyzeStep(state, options);
    }, 
    options
  );
}