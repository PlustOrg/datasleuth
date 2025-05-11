// filepath: /Users/jacquesmarais/Documents/Personal/deep-research-api/packages/core/tests/mocks/factCheck-mock.ts
/**
 * Mock implementation of the factCheck step for testing
 * This version doesn't rely on LLMs or the AI SDK
 */
import { createStep } from '../../src/utils/steps';
import { ResearchState, FactCheckResult } from '../../src/types/pipeline';
import { ConfigurationError, LLMError, ValidationError } from '../../src/types/errors';
import { logger, createStepLogger } from '../../src/utils/logging';

/**
 * Mock options for the fact check step
 */
export interface MockFactCheckOptions {
  /** Minimum confidence threshold for validation (0.0 to 1.0) */
  threshold?: number;
  /** Whether to include evidence in the output */
  includeEvidence?: boolean;
  /** Whether to include fact check results in the final results */
  includeInResults?: boolean;
  /** Specific statements to check (if empty, will extract from content) */
  statements?: string[];
  /** Maximum number of statements to check */
  maxStatements?: number;
  /** Custom prompt for the fact-checking LLM (not used in mock) */
  customPrompt?: string; 
  /** Whether to continue if some statements fail to check */
  continueOnError?: boolean;
  /** Whether to continue even if zero extracted content is available */
  allowEmptyContent?: boolean;
  /** Whether this mock should throw an error (for testing error handling) */
  shouldError?: boolean;
  /** Custom error message when shouldError is true */
  errorMessage?: string;
  /** Predefined mock fact check results to return */
  mockResults?: FactCheckResult[];
  /** Confidence values for each statement (overrides default) */
  mockConfidences?: number[];
  /** Validity values for each statement (overrides default) */
  mockValidities?: boolean[];
}

// Default mock fact check result
const DEFAULT_FACT_CHECK_RESULT: FactCheckResult = {
  statement: "Test statement 1",
  isValid: true,
  confidence: 0.9,
  evidence: ["Evidence for statement 1"]
};

/**
 * Creates a mock fact check for testing
 */
async function executeMockFactCheckStep(
  state: ResearchState,
  options: MockFactCheckOptions = {}
): Promise<ResearchState> {
  const stepLogger = createStepLogger('FactCheck');
  
  const {
    threshold = 0.7,
    includeEvidence = true,
    includeInResults = true,
    statements = [],
    maxStatements = 10,
    continueOnError = true,
    allowEmptyContent = false,
    shouldError = false,
    errorMessage = 'Mock fact check failure',
    mockResults = [],
    mockConfidences = [],
    mockValidities = []
  } = options;

  stepLogger.info('Starting mock fact checking');

  try {
    // If shouldError is true, throw an error (for testing error handling)
    if (shouldError) {
      throw new LLMError({
        message: errorMessage,
        step: 'FactCheck',
        details: { options },
        retry: true,
        suggestions: [
          "This is a mock error for testing",
          "No real LLM is being used"
        ]
      });
    }
    
    // Get statements to fact check
    let statementsToCheck: string[] = [...statements];
    
    // If no statements provided, extract from content
    if (statementsToCheck.length === 0 && state.data.extractedContent) {
      stepLogger.debug('Extracting statements from mock content');
      
      // Simple mock extraction logic - extract a test statement for each content item
      statementsToCheck = state.data.extractedContent.map((content, i) => 
        `Test statement ${i + 1} from ${content.title}`
      ).slice(0, maxStatements);
    }
    
    if (statementsToCheck.length === 0) {
      stepLogger.warn('No statements found for fact checking');
      
      if (!allowEmptyContent) {
        throw new ValidationError({
          message: 'No content available for fact checking',
          step: 'FactCheck',
          details: { 
            hasExtractedContent: !!state.data.extractedContent,
            contentLength: state.data.extractedContent ? state.data.extractedContent.length : 0
          },
          suggestions: [
            "Ensure the content extraction step runs successfully before fact checking",
            "Provide statements explicitly via the 'statements' option if no content is available",
            "Set 'allowEmptyContent' to true if this step should be optional"
          ]
        });
      }
      
      return state;
    }
    
    stepLogger.info(`Mock fact checking ${statementsToCheck.length} statements`);
    
    const startTime = Date.now();
    
    // Generate fact check results
    const factCheckResults: FactCheckResult[] = [];
    
    for (let i = 0; i < statementsToCheck.length; i++) {
      const statement = statementsToCheck[i];
      
      // Check if we have a predefined mock result
      if (mockResults && mockResults[i]) {
        // Use the predefined mock result
        factCheckResults.push(mockResults[i]);
        continue;
      }
      
      // Otherwise generate a mock result
      const confidence = mockConfidences && mockConfidences[i] !== undefined 
        ? mockConfidences[i] 
        : 0.9;
      
      const isValid = mockValidities && mockValidities[i] !== undefined
        ? mockValidities[i]
        : true;
      
      // Skip results with confidence below threshold
      if (confidence < threshold) {
        continue;
      }
      
      factCheckResults.push({
        statement: statement,
        isValid: isValid,
        confidence: confidence,
        evidence: includeEvidence ? [`Evidence for statement: ${statement}`] : undefined
      });
    }
    
    const timeTaken = Date.now() - startTime;
    stepLogger.info(`Mock fact checking completed in ${timeTaken}ms`);
    
    // Calculate overall factual accuracy score
    const validStatements = factCheckResults.filter(result => result.isValid);
    const factualAccuracyScore = validStatements.length / factCheckResults.length || 0;
    
    // Update state with fact check results
    const newState = {
      ...state,
      data: {
        ...state.data,
        factChecks: factCheckResults,
        factualAccuracyScore,
        factCheckMetadata: {
          totalChecked: factCheckResults.length,
          valid: validStatements.length,
          invalid: factCheckResults.length - validStatements.length,
          averageConfidence: factCheckResults.length 
            ? factCheckResults.reduce((sum, check) => sum + check.confidence, 0) / factCheckResults.length 
            : 0,
          executionTimeMs: timeTaken,
          timestamp: new Date().toISOString()
        }
      },
      metadata: {
        ...state.metadata,
        confidenceScore: factualAccuracyScore,
      },
    };

    // Add to results if requested
    if (includeInResults && factCheckResults.length > 0) {
      return {
        ...newState,
        results: [
          ...newState.results,
          {
            factChecks: factCheckResults,
            factualAccuracyScore,
            factCheckStats: {
              total: factCheckResults.length,
              valid: validStatements.length,
              invalid: factCheckResults.length - validStatements.length,
              averageConfidence: newState.data.factCheckMetadata.averageConfidence
            }
          },
        ],
      };
    }

    return newState;
  } catch (error: unknown) {
    // Just re-throw the error for test assertions to catch
    throw error;
  }
}

/**
 * Creates a mock fact check step for testing
 * 
 * @param options Configuration options for the mock fact check step
 * @returns A mock fact check step for testing
 */
export function mockFactCheck(options: MockFactCheckOptions = {}): ReturnType<typeof createStep> {
  return createStep(
    'FactCheck', 
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeMockFactCheckStep(state, options);
    }, 
    options,
    {
      // Mark as retryable by default for the entire step
      retryable: true,
      // Mark as optional if allowEmptyContent is true
      optional: options.allowEmptyContent || false
    }
  );
}