/**
 * Summarization step for the research pipeline
 * Synthesizes information into concise summaries using LLMs
 */
import * as mastra from 'mastra';
import { createStep } from '../utils/steps';
import { ResearchState, ExtractedContent, FactCheckResult } from '../types/pipeline';
import { StepOptions } from '../types/pipeline';
import { z } from 'zod';
import { generateText, LanguageModel } from 'ai';
import { 
  ValidationError, 
  ConfigurationError, 
  LLMError,
  ProcessingError 
} from '../types/errors';
import { logger, createStepLogger } from '../utils/logging';
import { executeWithRetry } from '../utils/retry';

/**
 * Format options for summary output
 */
export type SummaryFormat = 'paragraph' | 'bullet' | 'structured';

/**
 * Options for the summarization step
 */
export interface SummarizeOptions extends StepOptions {
  /** Maximum length of the generated summary (characters) */
  maxLength?: number;
  /** Model to use for summarization (from the AI SDK) */
  llm?: LanguageModel;
  /** Temperature for the LLM generation (0.0 to 1.0) */
  temperature?: number;
  /** Format for the summary (paragraph, bullet, structured) */
  format?: SummaryFormat;
  /** Focus areas for the summary (aspects to emphasize) */
  focus?: string | string[];
  /** Whether to include citations in the summary */
  includeCitations?: boolean;
  /** Whether to add the summary to the final results */
  includeInResults?: boolean;
  /** Custom prompt for summary generation */
  customPrompt?: string;
  /** Additional instructions for summary generation */
  additionalInstructions?: string;
  /** Retry configuration for LLM calls */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Default summarization prompt
 */
const DEFAULT_SUMMARIZE_PROMPT = `
You are an expert research synthesizer. Your task is to create a comprehensive summary
of the provided information.

Create a well-structured summary that:
1. Captures the key points and insights
2. Presents information in a logical flow
3. Maintains factual accuracy
4. Highlights areas of consensus and disagreement
5. Notes any limitations in the research

Your summary should be concise yet thorough, prioritizing the most important findings.
`;

/**
 * Executes the summarization step
 */
async function executeSummarizeStep(
  state: ResearchState,
  options: SummarizeOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Summarization');
  
  const {
    maxLength = 2000,
    llm,
    temperature = 0.3,
    format = 'paragraph',
    focus = [],
    includeCitations = true,
    includeInResults = true,
    customPrompt,
    additionalInstructions,
    retry = { maxRetries: 2, baseDelay: 1000 }
  } = options;

  stepLogger.info('Starting content summarization');
  
  try {
    // Validate temperature
    if (temperature < 0 || temperature > 1) {
      throw new ValidationError({
        message: `Invalid temperature value: ${temperature}. Must be between 0 and 1.`,
        step: 'Summarization',
        details: { temperature },
        suggestions: [
          "Temperature must be between 0.0 and 1.0",
          "Lower values (0.0-0.3) provide more consistent summaries",
          "Higher values (0.7-1.0) provide more creative summaries"
        ]
      });
    }
    
    // Validate maximum length
    if (maxLength <= 0) {
      throw new ValidationError({
        message: `Invalid maxLength value: ${maxLength}. Must be greater than 0.`,
        step: 'Summarization',
        details: { maxLength },
        suggestions: [
          "Maximum length must be a positive number",
          "Recommended values are between 500-5000 characters"
        ]
      });
    }
    
    // Get content to summarize
    const contentToSummarize: string[] = [];
    
    // Add extracted content if available
    if (state.data.extractedContent) {
      contentToSummarize.push(...state.data.extractedContent.map((item: ExtractedContent) => item.content));
    }
    
    // Add research plan if available
    if (state.data.researchPlan) {
      contentToSummarize.push(JSON.stringify(state.data.researchPlan));
    }
    
    // Add factual information if available
    if (state.data.factChecks) {
      const validFactChecks = state.data.factChecks.filter((check: FactCheckResult) => check.isValid);
      contentToSummarize.push(...validFactChecks.map((check: FactCheckResult) => check.statement));
    }
    
    if (contentToSummarize.length === 0) {
      stepLogger.warn('No content found for summarization');
      return {
        ...state,
        metadata: {
          ...state.metadata,
          warnings: [
            ...(state.metadata.warnings || []),
            'Summarization step skipped due to lack of content.'
          ]
        }
      };
    }

    stepLogger.info(`Summarizing ${contentToSummarize.length} content items`);
    stepLogger.debug(`Format: ${format}, max length: ${maxLength}, include citations: ${includeCitations}`);
    
    // Normalize focus to array if it's a string
    const focusArray = typeof focus === 'string' ? [focus] : focus;
    
    // Check for an LLM to use - either from options or from state
    const modelToUse = llm || state.defaultLLM;
    
    // If no LLM is available, throw an error
    if (!modelToUse) {
      throw new ConfigurationError({
        message: "No language model provided for summarization step",
        step: 'Summarization',
        details: { options },
        suggestions: [
          "Provide an LLM in the step options using the 'llm' parameter",
          "Set a defaultLLM when initializing the research function",
          "Example: research({ defaultLLM: openai('gpt-4'), ... })"
        ]
      });
    }

    // Generate summary using the provided LLM with retry logic
    const summary = await executeWithRetry(
      () => generateSummaryWithLLM(
        contentToSummarize,
        state.query,
        maxLength,
        format,
        focusArray,
        includeCitations,
        additionalInstructions,
        modelToUse,
        temperature,
        customPrompt
      ),
      {
        maxRetries: retry.maxRetries ?? 2,
        retryDelay: retry.baseDelay ?? 1000,
        backoffFactor: 2,
        onRetry: (attempt, error, delay) => {
          stepLogger.warn(`Retry attempt ${attempt} for summarization: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying in ${delay}ms...`);
        }
      }
    );
    
    stepLogger.info(`Summary generated successfully (${summary.length} characters)`);
    
    // Update state with summary
    const newState = {
      ...state,
      data: {
        ...state.data,
        summary,
      },
      metadata: {
        ...state.metadata,
        summaryLength: summary.length,
        summaryFormat: format
      }
    };

    // Add to results if requested
    if (includeInResults) {
      return {
        ...newState,
        results: [
          ...newState.results,
          { summary },
        ],
      };
    }

    return newState;
  } catch (error: unknown) {
    // Handle different error types appropriately
    if (error instanceof ValidationError || 
        error instanceof LLMError || 
        error instanceof ConfigurationError) {
      // These are already properly formatted, just throw them
      throw error;
    }
    
    // Handle generic errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    stepLogger.error(`Error during summarization: ${errorMessage}`);
    
    // Check for specific error patterns
    if (errorMessage.includes('context') || errorMessage.includes('token limit')) {
      throw new LLMError({
        message: `LLM context length exceeded during summarization: ${errorMessage}`,
        step: 'Summarization',
        details: { error },
        retry: false,
        suggestions: [
          "Reduce the amount of content being summarized",
          "Use a model with larger context window",
          "Consider breaking the summarization into multiple steps"
        ]
      });
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      throw new LLMError({
        message: `LLM rate limit exceeded during summarization: ${errorMessage}`,
        step: 'Summarization',
        details: { error },
        retry: true,
        suggestions: [
          "Wait and try again later",
          "Consider using a different LLM provider",
          "Implement rate limiting in your application"
        ]
      });
    }
    
    // Generic processing error
    throw new ProcessingError({
      message: `Summarization failed: ${errorMessage}`,
      step: 'Summarization',
      details: { error, options },
      retry: true,
      suggestions: [
        "Check your summarization configuration",
        "Try with a smaller set of content",
        "Consider using a different LLM provider or model"
      ]
    });
  }
}

/**
 * Generate summary using the provided LLM from the AI SDK
 */
async function generateSummaryWithLLM(
  contentItems: string[],
  query: string,
  maxLength: number,
  format: SummaryFormat,
  focus: string[],
  includeCitations: boolean,
  additionalInstructions: string | undefined,
  llm: LanguageModel,
  temperature: number,
  customPrompt?: string
): Promise<string> {
  const logger = createStepLogger('SummaryGenerator');
  
  try {
    // Prepare the content to summarize (limit to avoid token limits)
    const contentText = contentItems.join('\n\n').slice(0, 15000);
    
    // Build formatting instructions based on the requested format
    let formatInstructions = '';
    switch (format) {
      case 'paragraph':
        formatInstructions = 'structure the summary as coherent paragraphs with a logical flow';
        break;
      case 'bullet':
        formatInstructions = 'structure the summary as bullet points highlighting key insights';
        break;
      case 'structured':
        formatInstructions = 'structure the summary with clear sections using markdown headings (## for main sections, ### for subsections)';
        break;
    }
    
    // Build focus instructions if any focus areas are specified
    const focusInstructions = focus.length > 0
      ? `Pay particular attention to these aspects: ${focus.join(', ')}.`
      : '';
    
    // Build citation instructions
    const citationInstructions = includeCitations
      ? 'Include citations to relevant sources, formatted as a numbered list at the end of the summary.'
      : 'Do not include citations.';
    
    // Add the additional instructions if provided
    const extraInstructions = additionalInstructions
      ? `Additional requirements: ${additionalInstructions}`
      : '';
    
    // Use custom prompt or default
    const systemPrompt = customPrompt || DEFAULT_SUMMARIZE_PROMPT;
    
    // Construct the prompt for summary generation
    const summaryPrompt = `
Query: "${query}"

CONTENT TO SUMMARIZE:
${contentText}

Create a ${format} summary of the above content related to the query "${query}".
${focusInstructions}
${formatInstructions}
${citationInstructions}
${extraInstructions}

Keep your summary under ${maxLength} characters.
`;

    logger.debug(`Generating summary with ${format} format, maxLength: ${maxLength}`);
    
    // Generate the summary using the AI SDK
    const { text } = await generateText({
      model: llm,
      system: systemPrompt,
      prompt: summaryPrompt,
      temperature,
      maxTokens: Math.floor(maxLength / 4), // rough character to token conversion
    });

    logger.debug(`Summary generated with ${text.length} characters`);
    
    // Ensure we don't exceed the max length
    return text.length > maxLength 
      ? text.substring(0, maxLength - 3) + '...' 
      : text;
  } catch (error: unknown) {
    logger.error(`Error generating summary with LLM: ${error instanceof Error ? error.message : String(error)}`);
    
    // Format the error for better handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for specific error patterns and throw appropriate errors
    if (errorMessage.includes('context') || errorMessage.includes('token limit')) {
      throw new LLMError({
        message: `LLM context length exceeded: ${errorMessage}`,
        step: 'Summarization',
        details: { error, contentLength: contentItems.join('\n\n').length },
        retry: false,
        suggestions: [
          "Reduce the amount of content being summarized",
          "Use a model with larger context window",
          "Break the content into smaller chunks"
        ]
      });
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      throw new LLMError({
        message: `LLM rate limit exceeded: ${errorMessage}`,
        step: 'Summarization',
        details: { error },
        retry: true,
        suggestions: [
          "Wait and try again later",
          "Implement request throttling in your application",
          "Consider using a different LLM provider or API key"
        ]
      });
    }
    
    // Generic LLM error
    throw new LLMError({
      message: `Error generating summary: ${errorMessage}`,
      step: 'Summarization',
      details: { error },
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
 * Creates a summarization step for the research pipeline
 * 
 * @param options Configuration options for summarization
 * @returns A summarization step for the research pipeline
 */
export function summarize(options: SummarizeOptions = {}): ReturnType<typeof createStep> {
  return createStep('Summarize', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: StepOptions) => {
      return executeSummarizeStep(state, options);
    }, 
    options,
    {
      // Mark as retryable by default for the entire step
      retryable: true,
      maxRetries: options.retry?.maxRetries || 2,
      retryDelay: options.retry?.baseDelay || 1000,
      backoffFactor: 2
    }
  );
}