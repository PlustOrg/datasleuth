/**
 * Analysis step for the research pipeline
 * Extracts insights on specific topics or aspects from collected data
 */
import * as mastra from 'mastra';
import { createStep } from '../utils/steps';
import { ResearchState } from '../types/pipeline';
import { z } from 'zod';
import { generateText, LanguageModel } from 'ai';

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
  const {
    focus,
    llm,
    temperature = 0.3,
    depth = 'detailed',
    includeEvidence = true,
    includeRecommendations = true,
    includeInResults = true,
    customPrompt,
  } = options;

  console.log(`Analyzing with focus: ${focus}, depth: ${depth}`);
  
  // Get relevant content for analysis
  const contentToAnalyze: string[] = [];
  
  // Add extracted content if available
  if (state.data.extractedContent) {
    contentToAnalyze.push(...state.data.extractedContent.map((item: any) => item.content));
  }
  
  // Add factual information if available (only valid facts)
  if (state.data.factChecks) {
    const validFactChecks = state.data.factChecks.filter((check: any) => check.isValid);
    contentToAnalyze.push(...validFactChecks.map((check: any) => check.statement));
  }
  
  if (contentToAnalyze.length === 0) {
    console.warn('No content found for analysis');
    return state;
  }

  // Check for an LLM to use - either from options or from state
  const modelToUse = llm || state.defaultLLM;
  
  // If no LLM is available, throw an error
  if (!modelToUse) {
    throw new Error(
      "No language model provided for analysis step. Please provide an LLM either in the step options or as a defaultLLM in the research function."
    );
  }

  // Generate analysis using the provided LLM
  const analysisResult = await generateAnalysisWithLLM(
    contentToAnalyze,
    state.query,
    focus,
    depth,
    includeEvidence,
    includeRecommendations,
    modelToUse,
    temperature,
    customPrompt
  );
  
  // Store the analysis in the appropriate format
  const focusKey = focus.replace(/\s+/g, '-').toLowerCase();
  
  // Update state with analysis
  const newState = {
    ...state,
    data: {
      ...state.data,
      analysis: {
        ...(state.data.analysis || {}),
        [focusKey]: analysisResult,
      },
    },
  };

  // Add to results if requested
  if (includeInResults) {
    return {
      ...newState,
      results: [
        ...newState.results,
        { analysis: { [focusKey]: analysisResult } },
      ],
    };
  }

  return newState;
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
  customPrompt?: string
): Promise<AnalysisResult> {
  try {
    // Prepare the content to analyze
    const contentText = contentItems.join('\n\n');
    
    // Create a system prompt by replacing placeholders in the template
    const systemPrompt = (customPrompt || DEFAULT_ANALYSIS_PROMPT)
      .replace('{focus}', focus)
      .replace('{depth}', depth);
    
    // Construct the prompt for analysis
    const analysisPrompt = `
Query: "${query}"

CONTENT TO ANALYZE:
${contentText}

Focus specifically on aspects related to "${focus}" and provide a ${depth} analysis.
${includeEvidence ? 'Include supporting evidence from the provided content.' : ''}
${includeRecommendations ? 'Provide actionable recommendations based on your analysis.' : ''}

Format your response as valid JSON with the following structure:
{
  "focus": "${focus}",
  "insights": ["insight 1", "insight 2", ...],
  "confidence": 0.85, // a number between 0 and 1 representing your confidence in this analysis
  ${includeEvidence ? '"supportingEvidence": ["evidence 1", "evidence 2", ...],' : ''}
  "limitations": ["limitation 1", "limitation 2", ...],
  ${includeRecommendations ? '"recommendations": ["recommendation 1", "recommendation 2", ...]' : ''}
}

Ensure the JSON is properly formatted with no trailing commas.
`;

    // Generate the analysis using the AI SDK
    const { text } = await generateText({
      model: llm,
      system: systemPrompt,
      prompt: analysisPrompt,
      temperature,
    });

    // Parse the JSON response
    try {
      const parsedAnalysis = JSON.parse(text);
      return analysisResultSchema.parse(parsedAnalysis);
    } catch (parseError) {
      console.error('Failed to parse LLM response as valid JSON:', parseError);
      console.debug('Raw LLM response:', text);
      throw new Error('LLM response was not valid JSON for analysis result');
    }
  } catch (error: unknown) {
    console.error('Error generating analysis with LLM:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate analysis: ${errorMessage}`);
  }
}

/**
 * Creates an analysis step for the research pipeline
 * 
 * @param options Configuration options for analysis
 * @returns An analysis step for the research pipeline
 */
export function analyze(options: AnalyzeOptions): ReturnType<typeof createStep> {
  return createStep('Analyze', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeAnalyzeStep(state, options);
    }, 
    options
  );
}