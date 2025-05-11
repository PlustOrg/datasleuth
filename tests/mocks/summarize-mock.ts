// filepath: /Users/jacquesmarais/Documents/Personal/deep-research-api/packages/core/tests/mocks/summarize-mock.ts
/**
 * Mock implementation of the summarize step for testing
 * This version doesn't rely on LLMs or the AI SDK
 */
import { createStep } from '../../src/utils/steps';
import { ResearchState } from '../../src/types/pipeline';
import { ConfigurationError, LLMError, ValidationError } from '../../src/types/errors';
import { logger, createStepLogger } from '../../src/utils/logging';

/**
 * Mock options for the summarize step
 */
export interface MockSummarizeOptions {
  /** Format of the summary: 'standard' or 'structured' */
  format?: 'standard' | 'structured';
  /** Maximum length of the summary in characters */
  maxLength?: number;
  /** Whether to focus only on factually verified content */
  factsOnly?: boolean;
  /** Whether to include the summary in the final results */
  includeInResults?: boolean;
  /** Custom prompt for summary generation (not used in mock) */
  customPrompt?: string;
  /** Whether to continue even if zero extracted content is available */
  allowEmptyContent?: boolean;
  /** Whether this mock should throw an error (for testing error handling) */
  shouldError?: boolean;
  /** Custom error message when shouldError is true */
  errorMessage?: string;
  /** Predefined mock summary to return (otherwise uses default mock summary) */
  mockSummary?: string | Record<string, any>;
}

// Default mock standard summary
const DEFAULT_MOCK_SUMMARY = 'This is a mock summary for testing purposes. It includes the main findings and insights from the research.';

// Default mock structured summary
const DEFAULT_MOCK_STRUCTURED_SUMMARY = {
  summary: 'This is a structured summary for testing',
  keyPoints: ['Key point 1', 'Key point 2'],
  sources: ['https://example.com/1', 'https://example.com/2']
};

/**
 * Creates a mock summary for testing
 */
async function executeMockSummarizeStep(
  state: ResearchState,
  options: MockSummarizeOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Summarize');
  
  const {
    format = 'text',
    maxLength,
    factsOnly = false,
    includeInResults = false,
    allowEmptyContent = false,
    shouldError = false,
    errorMessage = 'Mock summarization failure',
    mockSummary = DEFAULT_MOCK_SUMMARY
  } = options;

  stepLogger.info('Starting mock summarization');

  try {
    // If shouldError is true, throw an error (for testing error handling)
    if (shouldError) {
      throw new LLMError({
        message: errorMessage,
        step: 'Summarize',
        details: { options },
        retry: true,
        suggestions: [
          "This is a mock error for testing",
          "No real LLM is being used"
        ]
      });
    }
    
    // Check if there's content to summarize
    if (!state.data.extractedContent || state.data.extractedContent.length === 0) {
      if (!allowEmptyContent) {
        throw new ValidationError({
          message: 'No content available for summarization',
          step: 'Summarize',
          details: { options },
          suggestions: [
            "Ensure the content extraction step has been executed",
            "Check that the search results returned valid content",
            "Use allowEmptyContent: true to continue even with no content"
          ]
        });
      }
      
      // If empty content is allowed, just return the state unchanged
      stepLogger.warn('No content available for summarization, skipping (allowEmptyContent=true)');
      return state;
    }
    
    const startTime = Date.now();
    
    // Generate summary based on format
    let summaryContent: string;
    let structuredSummaryObj: Record<string, any> | null = null;
    
    if (format === 'structured') {
      // For structured format, use the structured mock or convert text to structured
      if (typeof mockSummary === 'object') {
        structuredSummaryObj = mockSummary as Record<string, any>;
      } else {
        // Create a structured summary from the text mock
        structuredSummaryObj = {
          summary: typeof mockSummary === 'string' ? mockSummary : 'Mock structured summary',
          keyPoints: [
            "Key point 1 from mock summarization",
            "Key point 2 from mock summarization"
          ],
          sources: [
            "https://example.com/1",
            "https://example.com/2"
          ]
        };
      }
      
      // Convert to JSON string for storage in the state.data.summary field
      summaryContent = JSON.stringify(structuredSummaryObj);
    } else {
      // For text format, use the text mock
      summaryContent = typeof mockSummary === 'string' 
        ? mockSummary 
        : 'Mock text summary for testing';
        
      // Handle maxLength if specified
      if (maxLength && summaryContent.length > maxLength) {
        summaryContent = summaryContent.substring(0, maxLength) + '...';
      }
      
      // If factsOnly is true, modify the summary to reflect that
      if (factsOnly && state.data.factChecks && state.data.factChecks.length > 0) {
        const validFacts = state.data.factChecks.filter(fact => fact.isValid);
        summaryContent = `Summary based only on verified facts: ${validFacts.map(f => f.statement).join('. ')}`;
      }
    }
    
    const timeTaken = Date.now() - startTime;
    stepLogger.info(`Mock summarization completed in ${timeTaken}ms`);

    // Store the summary in state
    const newState = {
      ...state,
      data: {
        ...state.data,
        summary: summaryContent
      },
      metadata: {
        ...state.metadata,
        summarizationTimeMs: timeTaken
      }
    };

    // Add the summary to results if requested
    if (includeInResults) {
      // If structured format, parse the JSON string back to an object for the results
      const resultSummary = format === 'structured' && structuredSummaryObj
        ? structuredSummaryObj
        : { summary: summaryContent };
        
      return {
        ...newState,
        results: [...newState.results, resultSummary],
      };
    }

    return newState;
  } catch (error) {
    // Just re-throw the error for test assertions to catch
    throw error;
  }
}

/**
 * Creates a mock summarize step for testing
 * 
 * @param options Configuration options for the mock summarize step
 * @returns A mock summarize step for testing
 */
export function mockSummarize(options: MockSummarizeOptions = {}): ReturnType<typeof createStep> {
  return createStep(
    'Summarize', 
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeMockSummarizeStep(state, options);
    }, 
    options,
    {
      // Mark as optional if allowEmptyContent is true
      optional: options.allowEmptyContent || false
    }
  );
}