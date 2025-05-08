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

  let analysisResult: AnalysisResult;

  // Check if an LLM model was provided
  if (llm) {
    // Use the provided LLM model to generate the analysis
    analysisResult = await generateAnalysisWithLLM(
      contentToAnalyze,
      state.query,
      focus,
      depth,
      includeEvidence,
      includeRecommendations,
      llm,
      temperature,
      customPrompt
    );
  } else {
    // Fall back to simulated analysis if no LLM is provided
    console.warn('No LLM model provided for analysis step. Using simulated analysis.');
    analysisResult = await simulateAnalysis(
      contentToAnalyze,
      state.query,
      focus,
      depth,
      includeEvidence,
      includeRecommendations
    );
  }
  
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
 * Simulates analysis generation using an LLM
 * In a real implementation, this would call an actual LLM
 */
async function simulateAnalysis(
  contentItems: string[],
  query: string,
  focus: string,
  depth: string,
  includeEvidence: boolean,
  includeRecommendations: boolean
): Promise<AnalysisResult> {
  // Simulate a delay as if we're calling an LLM
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Generate simulated insights based on the focus area
  const insights: string[] = [];
  const supportingEvidence: string[] = [];
  const limitations: string[] = [];
  const recommendations: string[] = [];
  
  // Generate different insights based on the focus area
  switch (focus.toLowerCase()) {
    case 'market-trends':
      insights.push(
        `The market for ${query} shows consistent growth with a CAGR of approximately 15-20% over the past five years.`,
        `${query} is seeing increased adoption in emerging markets, particularly in Asia-Pacific and Latin America.`,
        `Key players are shifting towards more sustainable and cost-effective solutions in the ${query} space.`,
        `Regulatory changes in North America and Europe are reshaping competitive dynamics in the ${query} market.`
      );
      
      supportingEvidence.push(
        `Multiple market reports from 2023-2025 confirm the growth trajectory and regional expansion patterns.`,
        `Earnings calls from major companies in this sector indicate strategic pivots toward sustainability.`
      );
      
      limitations.push(
        `Limited data on niche market segments within the broader ${query} category.`,
        `Evolving regulatory landscape makes long-term projections uncertain.`
      );
      
      recommendations.push(
        `Monitor regulatory developments in key markets to anticipate shifts in demand patterns.`,
        `Focus on sustainable solutions as this appears to be a key differentiator in the market.`,
        `Consider strategic partnerships in emerging markets to capitalize on regional growth opportunities.`
      );
      break;
      
    case 'technical-details':
      insights.push(
        `The technological foundation of ${query} relies primarily on advancements in AI and machine learning algorithms.`,
        `Recent innovations have significantly improved efficiency metrics, with performance gains of 30-40% reported.`,
        `Integration challenges remain a barrier to widespread adoption of newer ${query} technologies.`,
        `Open-source developments are accelerating innovation cycles in the ${query} technical ecosystem.`
      );
      
      supportingEvidence.push(
        `Technical papers from 2024-2025 document the performance improvements and methodological approaches.`,
        `GitHub repository activity shows increasing community engagement with open-source ${query} projects.`
      );
      
      limitations.push(
        `Limited benchmarking across different implementation strategies makes direct comparisons difficult.`,
        `The rapid pace of innovation may lead to fragmentation in standards and approaches.`
      );
      
      recommendations.push(
        `Invest in compatibility and integration capabilities to address key adoption barriers.`,
        `Engage with open-source communities to stay current with cutting-edge developments.`,
        `Develop clear performance metrics aligned with actual use case requirements.`
      );
      break;
      
    default:
      // Generic insights for any other focus area
      insights.push(
        `Analysis of ${query} reveals important patterns related to ${focus}.`,
        `Key stakeholders are increasingly attentive to ${focus} aspects of ${query}.`,
        `There appears to be a correlation between ${focus} and overall outcomes in ${query} implementations.`,
        `Comparative assessment suggests that ${focus} is becoming a critical success factor for ${query}.`
      );
      
      supportingEvidence.push(
        `Multiple sources highlight the significance of ${focus} in relation to ${query}.`,
        `Empirical data supports the correlation between ${focus} factors and outcomes.`
      );
      
      limitations.push(
        `The research on ${focus} in the context of ${query} is still developing.`,
        `Methodological variations make it difficult to generalize findings across different contexts.`
      );
      
      recommendations.push(
        `Develop a systematic approach to incorporate ${focus} considerations into ${query} strategies.`,
        `Establish metrics to track the impact of ${focus} on overall performance and outcomes.`,
        `Collaborate with experts in ${focus} to enhance ${query} initiatives.`
      );
  }
  
  // Adjust depth of analysis
  if (depth === 'basic') {
    // Reduce the number of insights for basic analysis
    insights.length = Math.min(2, insights.length);
    supportingEvidence.length = Math.min(1, supportingEvidence.length);
    limitations.length = Math.min(1, limitations.length);
    recommendations.length = Math.min(1, recommendations.length);
  } else if (depth === 'comprehensive') {
    // Add more detailed insights for comprehensive analysis
    insights.push(`Long-term trajectory analysis suggests that ${focus} aspects of ${query} will continue to evolve in response to broader industry and societal trends.`);
    supportingEvidence.push(`Cross-industry comparisons provide additional context for understanding the evolution of ${focus} in relation to ${query}.`);
    limitations.push(`The interplay between ${focus} and other factors creates complexity that requires nuanced analysis.`);
    recommendations.push(`Establish a continuous monitoring process to track developments in ${focus} as they relate to ${query} over time.`);
  }
  
  // Final analysis result
  return {
    focus,
    insights,
    confidence: 0.75 + (Math.random() * 0.2), // Between 0.75 and 0.95
    supportingEvidence: includeEvidence ? supportingEvidence : undefined,
    limitations,
    recommendations: includeRecommendations ? recommendations : undefined,
  };
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