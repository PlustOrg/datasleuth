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
  } = options;

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
    console.warn('No content found for summarization');
    return state;
  }

  console.log(`Summarizing ${contentToSummarize.length} content items...`);
  
  // Normalize focus to array if it's a string
  const focusArray = typeof focus === 'string' ? [focus] : focus;
  
  // Check for an LLM to use - either from options or from state
  const modelToUse = llm || state.defaultLLM;
  
  // If no LLM is available, throw an error
  if (!modelToUse) {
    throw new Error(
      "No language model provided for summarization step. Please provide an LLM either in the step options or as a defaultLLM in the research function."
    );
  }

  // Generate summary using the provided LLM
  const summary = await generateSummaryWithLLM(
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
  );
  
  // Update state with summary
  const newState = {
    ...state,
    data: {
      ...state.data,
      summary,
    },
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

    // Generate the summary using the AI SDK
    const { text } = await generateText({
      model: llm,
      system: systemPrompt,
      prompt: summaryPrompt,
      temperature,
      maxTokens: Math.floor(maxLength / 4), // rough character to token conversion
    });

    // Ensure we don't exceed the max length
    return text.length > maxLength 
      ? text.substring(0, maxLength - 3) + '...' 
      : text;
  } catch (error: unknown) {
    console.error('Error generating summary with LLM:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Return a basic error summary
    return `Error generating summary: ${errorMessage}. Please try again with a different model or configuration.`;
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
    options
  );
}