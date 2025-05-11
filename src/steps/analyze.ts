/**
 * Analysis step for the research pipeline
 * Extracts insights on specific topics or aspects from collected data
 */
import * as mastra from 'mastra';
import { createStep } from '../utils/steps';
import { ResearchState } from '../types/pipeline';
import { z } from 'zod';
import { generateText, generateObject, LanguageModel } from 'ai';
import { 
  ValidationError, 
  LLMError, 
  ConfigurationError 
} from '../types/errors';
import { logger, createStepLogger } from '../utils/logging';
import { executeWithRetry } from '../utils/retry';

/**
 * Schema for analysis results
 */
const analysisResultSchema = z.object({
  focus: z.string(),
  insights: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  supportingEvidence: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/**
 * Options for the analysis step
 */
export interface AnalyzeOptions {
  /** Focus area for analysis (e.g., 'market-trends', 'technical-details') */
  focus: string;
  /** Model to use for analysis (from the AI SDK) */
  llm?: LanguageModel;
  /** Temperature for the LLM (0.0 to 1.0) */
  temperature?: number;
  /** Depth of analysis ('basic', 'detailed', 'comprehensive') */
  depth?: 'basic' | 'detailed' | 'comprehensive';
  /** Whether to include supporting evidence in the analysis */
  includeEvidence?: boolean;
  /** Whether to include recommendations in the analysis */
  includeRecommendations?: boolean;
  /** Whether to add the analysis to the final results */
  includeInResults?: boolean;
  /** Custom prompt for analysis */
  customPrompt?: string;
  /** Whether to proceed if no content is available */
  allowEmptyContent?: boolean;
  /** Maximum content size for analysis (in characters) */
  maxContentSize?: number;
  /** Retry configuration for LLM calls */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Default analysis prompt template 
 */
const DEFAULT_ANALYSIS_PROMPT = `
You are an expert analyst focused on {focus}. Your task is to analyze the provided information
and extract key insights related to {focus}.

Create a {depth} analysis that:
1. Identifies the most significant patterns, trends, or findings related to {focus}
2. Evaluates the strength and reliability of the evidence
3. Notes any limitations or gaps in the available information
4. Provides actionable insights based on the analysis

Your analysis should be objective, evidence-based, and focused specifically on {focus}.
`;

/**
 * Executes specialized analysis on collected data
 */
async function executeAnalyzeStep(
  state: ResearchState,
  options: AnalyzeOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Analyze');
  
  const {
    focus,
    llm,
    temperature = 0.3,
    depth = 'detailed',
    includeEvidence = true,
    includeRecommendations = true,
    includeInResults = true,
    customPrompt,
    allowEmptyContent = false,
    maxContentSize = 10000, // Default max content size to prevent token limit issues
    retry = { maxRetries: 2, baseDelay: 1000 }
  } = options;

  stepLogger.info(`Starting analysis with focus: ${focus}, depth: ${depth}`);
  
  try {
    // Get relevant content for analysis
    let contentToAnalyze: string[] = [];
    
    // Add extracted content if available
    if (state.data.extractedContent) {
      stepLogger.debug(`Adding ${state.data.extractedContent.length} extracted content items to analysis`);
      contentToAnalyze.push(...state.data.extractedContent.map((item: any) => item.content));
    }
    
    // Add factual information if available (only valid facts)
    if (state.data.factChecks) {
      const validFactChecks = state.data.factChecks.filter((check: any) => check.isValid);
      stepLogger.debug(`Adding ${validFactChecks.length} validated fact statements to analysis`);
      contentToAnalyze.push(...validFactChecks.map((check: any) => check.statement));
    }
    
    if (contentToAnalyze.length === 0) {
      stepLogger.warn('No content found for analysis');
      
      if (!allowEmptyContent) {
        throw new ValidationError({
          message: 'No content available for analysis',
          step: 'Analyze',
          details: {
            hasExtractedContent: !!state.data.extractedContent,
            hasFactChecks: !!state.data.factChecks,
            focus
          },
          suggestions: [
            "Ensure content extraction or fact checking steps run successfully before analysis",
            "Set 'allowEmptyContent' to true if this step should be optional",
            "Provide explicit content to analyze via the research state"
          ]
        });
      }
      
      // If empty content is allowed, return state unchanged
      return state;
    }

    // Check for an LLM to use - either from options or from state
    const modelToUse = llm || state.defaultLLM;
    
    // If no LLM is available, throw an error
    if (!modelToUse) {
      throw new ConfigurationError({
        message: "No language model provided for analysis step",
        step: 'Analyze',
        details: { focus, options },
        suggestions: [
          "Provide an LLM in the step options using the 'llm' parameter",
          "Set a defaultLLM when initializing the research function",
          "Example: research({ defaultLLM: openai('gpt-4'), ... })"
        ]
      });
    }

    const startTime = Date.now();
    
    // Trim content if it exceeds the maximum size
    let totalContentSize = contentToAnalyze.join('\n\n').length;
    if (totalContentSize > maxContentSize) {
      stepLogger.warn(`Content size (${totalContentSize} chars) exceeds maximum (${maxContentSize}), trimming content`);
      
      // Sort by importance (prioritize fact-checked content)
      // This is a simplified approach - in a real implementation you might use more sophisticated methods
      const trimmedContent: string[] = [];
      let currentSize = 0;
      
      for (const content of contentToAnalyze) {
        const contentSize = content.length;
        if (currentSize + contentSize <= maxContentSize) {
          trimmedContent.push(content);
          currentSize += contentSize + 2; // +2 for the newlines
        } else {
          const remainingSize = maxContentSize - currentSize;
          if (remainingSize > 50) { // Only add if we can include a meaningful chunk
            trimmedContent.push(content.substring(0, remainingSize - 3) + '...');
          }
          break;
        }
      }
      
      contentToAnalyze = trimmedContent;
      totalContentSize = contentToAnalyze.join('\n\n').length;
      stepLogger.info(`Content trimmed to ${totalContentSize} chars (${contentToAnalyze.length} items)`);
    }

    // Generate analysis using the provided LLM with retry logic
    const analysisResult = await generateAnalysisWithLLM(
      contentToAnalyze,
      state.query,
      focus,
      depth,
      includeEvidence,
      includeRecommendations,
      modelToUse,
      temperature,
      customPrompt,
      retry,
      stepLogger
    );
    
    const timeTaken = Date.now() - startTime;
    stepLogger.info(`Analysis for focus "${focus}" completed in ${timeTaken}ms with confidence: ${analysisResult.confidence.toFixed(2)}`);
    stepLogger.debug(`Generated ${analysisResult.insights.length} insights for focus "${focus}"`);
    
    // Store the analysis in the appropriate format
    const focusKey = focus.replace(/\s+/g, '-').toLowerCase();
    
    // Update state with analysis and metadata
    const newState = {
      ...state,
      data: {
        ...state.data,
        analysis: {
          ...(state.data.analysis || {}),
          [focusKey]: analysisResult,
        },
        analysisMetadata: {
          ...(state.data.analysisMetadata || {}),
          [focusKey]: {
            executionTimeMs: timeTaken,
            contentSize: totalContentSize,
            contentItems: contentToAnalyze.length,
            insightsCount: analysisResult.insights.length,
            confidence: analysisResult.confidence,
            depth,
            timestamp: new Date().toISOString()
          }
        }
      },
      metadata: {
        ...state.metadata,
        confidenceScore: Math.max(
          state.metadata.confidenceScore || 0,
          analysisResult.confidence
        )
      }
    };

    // Add to results if requested
    if (includeInResults) {
      return {
        ...newState,
        results: [
          ...newState.results,
          { 
            analysis: { 
              [focusKey]: {
                ...analysisResult,
                metadata: newState.data.analysisMetadata[focusKey]
              } 
            } 
          },
        ],
      };
    }

    return newState;
  } catch (error: unknown) {
    // Handle specific error types
    if (error instanceof ValidationError || 
        error instanceof LLMError || 
        error instanceof ConfigurationError) {
      // These are already properly formatted errors, just throw them
      throw error;
    }
    
    // Handle generic errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    stepLogger.error(`Error during analysis execution: ${errorMessage}`);
    
    // Check error patterns to create appropriate error types
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      throw new LLMError({
        message: `Failed to parse LLM response as valid JSON during analysis: ${errorMessage}`,
        step: 'Analyze', 
        details: { error, focus: options.focus },
        retry: true,
        suggestions: [
          "Verify the prompt is properly constructed to elicit JSON",
          "Try a different model that produces more reliable structured output",
          "Consider simplifying the requested analysis"
        ]
      });
    } else if (errorMessage.includes('context') || errorMessage.includes('token limit')) {
      throw new LLMError({
        message: `LLM context length exceeded during analysis: ${errorMessage}`,
        step: 'Analyze',
        details: { error, focus: options.focus },
        retry: false,
        suggestions: [
          "Reduce the maxContentSize option",
          "Use a model with larger context window",
          "Split analysis into multiple focused queries"
        ]
      });
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      throw new LLMError({
        message: `LLM rate limit exceeded during analysis: ${errorMessage}`,
        step: 'Analyze',
        details: { error, focus: options.focus },
        retry: true,
        suggestions: [
          "Wait and try again later",
          "Implement request throttling in your application",
          "Consider using a different LLM provider or API key"
        ]
      });
    }
    
    // Generic LLM error fallback
    throw new LLMError({
      message: `Error during analysis with LLM: ${errorMessage}`,
      step: 'Analyze',
      details: { originalError: error, focus: options.focus },
      retry: true,
      suggestions: [
        "Check your LLM configuration",
        "Verify API key and model availability",
        "The LLM service might be experiencing issues, try again later"
      ]
    });
  }
}

/**
 * Generate analysis using the provided LLM from the AI SDK
 */
async function generateAnalysisWithLLM(
  contentItems: string[],
  query: string,
  focus: string,
  depth: string,
  includeEvidence: boolean,
  includeRecommendations: boolean,
  llm: LanguageModel,
  temperature: number,
  customPrompt?: string,
  retry?: { maxRetries?: number; baseDelay?: number },
  stepLogger?: ReturnType<typeof createStepLogger>
): Promise<AnalysisResult> {
  // Use default logger if stepLogger not provided
  const logger = stepLogger || createStepLogger('Analyze');
  
  return executeWithRetry(
    async () => {
      try {
        // Prepare the content to analyze
        const contentText = contentItems.join('\n\n');
        logger.debug(`Preparing analysis for ${contentItems.length} content items (${contentText.length} chars)`);
        
        // Create a system prompt by replacing placeholders in the template
        const systemPrompt = (customPrompt || DEFAULT_ANALYSIS_PROMPT)
          .replace('{focus}', focus)
          .replace('{depth}', depth);
        
        // Generate the analysis using the AI SDK with generateObject
        const { object } = await generateObject({
          model: llm,
          schema: analysisResultSchema,
          system: systemPrompt,
          prompt: `
Query: "${query}"

CONTENT TO ANALYZE:
${contentText}

Focus specifically on aspects related to "${focus}" and provide a ${depth} analysis.
${includeEvidence ? 'Include supporting evidence from the provided content.' : ''}
${includeRecommendations ? 'Provide actionable recommendations based on your analysis.' : ''}`,
          temperature,
        });

        logger.debug(`Successfully generated analysis with ${object.insights.length} insights`);
        return object;
      } catch (error: unknown) {
        // If it's already one of our error types, just rethrow it
        if (error instanceof ValidationError || error instanceof LLMError) {
          throw error;
        }
        
        // Otherwise wrap in LLMError
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error generating analysis with LLM: ${errorMessage}`);
        
        throw new LLMError({
          message: `Failed to generate analysis: ${errorMessage}`,
          step: 'Analyze',
          details: { error, focus },
          retry: true
        });
      }
    },
    {
      maxRetries: retry?.maxRetries ?? 2,
      retryDelay: retry?.baseDelay ?? 1000,
      backoffFactor: 2,
      onRetry: (attempt, error, delay) => {
        logger.warn(`Retry attempt ${attempt} for analysis: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying in ${delay}ms...`);
      }
    }
  );
}

/**
 * Creates an analysis step for the research pipeline
 * 
 * @param options Configuration options for analysis
 * @returns An analysis step for the research pipeline
 */
export function analyze(options: AnalyzeOptions): ReturnType<typeof createStep> {
  return createStep(
    'Analyze', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeAnalyzeStep(state, options);
    }, 
    options,
    {
      // Mark as retryable by default for the entire step
      retryable: true,
      maxRetries: options.retry?.maxRetries || 2,
      retryDelay: options.retry?.baseDelay || 1000,
      backoffFactor: 2,
      // Mark as optional if allowEmptyContent is true
      optional: options.allowEmptyContent || false
    }
  );
}