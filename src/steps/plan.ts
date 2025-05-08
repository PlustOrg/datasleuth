/**
 * Research planning step for the research pipeline
 * Creates structured research plan with objectives and search queries
 */
import { createStep } from '../utils/steps';
import { ResearchState } from '../types/pipeline';
import { z } from 'zod';
import { generateText, LanguageModel } from 'ai';

// Schema for research plan output
const researchPlanSchema = z.object({
  objectives: z.array(z.string()),
  searchQueries: z.array(z.string()),
  relevantFactors: z.array(z.string()),
  dataGatheringStrategy: z.string(),
  expectedOutcomes: z.array(z.string()),
});

// Type for research plan
export type ResearchPlan = z.infer<typeof researchPlanSchema>;

/**
 * Default system prompt for the planning agent
 */
const DEFAULT_PLANNING_PROMPT = `
You are a research planning assistant. Your job is to create a structured research plan based on a query.
Analyze the query carefully and develop a comprehensive strategy for researching this topic.

For the plan, provide:
1. Main research objectives (3-5 specific goals)
2. Specific search queries that would yield useful information (5-8 queries)
3. Key factors or aspects that are relevant to this research
4. An overall data gathering strategy
5. Expected outcomes from the research

Be specific, practical, and thorough. Consider what types of information would be most valuable to answer the query.
`;

/**
 * Options for the planning step
 */
export interface PlanOptions {
  /** Custom system prompt to override the default */
  customPrompt?: string;
  /** Model to use for planning (from the AI SDK) */
  llm?: LanguageModel;
  /** Temperature for the LLM (0.0 to 1.0) */
  temperature?: number;
  /** Whether to include the research plan in the final results */
  includeInResults?: boolean;
}

/**
 * Creates a research plan using an LLM
 */
async function executePlanStep(
  state: ResearchState,
  options: PlanOptions = {}
): Promise<ResearchState> {
  const {
    customPrompt = DEFAULT_PLANNING_PROMPT,
    temperature = 0.4,
    includeInResults = true,
    llm,
  } = options;

  let researchPlan: ResearchPlan;

  // Check if an LLM model was provided
  if (llm) {
    // Use the provided LLM model to generate a research plan
    researchPlan = await generateResearchPlanWithLLM(state.query, customPrompt, llm, temperature);
  } else {
    // Fall back to simulated plan if no LLM is provided
    console.warn('No LLM model provided for planning step. Using simulated research plan.');
    researchPlan = await simulateResearchPlan(state.query);
  }

  // Store the plan in state for later steps to use
  const newState = {
    ...state,
    data: {
      ...state.data,
      researchPlan,
    },
  };

  // Add the plan to results if requested
  if (includeInResults) {
    return {
      ...newState,
      results: [...newState.results, researchPlan],
    };
  }

  return newState;
}

/**
 * Generate a research plan using the provided LLM from the AI SDK
 */
async function generateResearchPlanWithLLM(
  query: string, 
  systemPrompt: string, 
  llm: LanguageModel,
  temperature: number
): Promise<ResearchPlan> {
  try {
    // Generate the research plan using the AI SDK
    const { text } = await generateText({
      model: llm,
      system: systemPrompt,
      prompt: `Create a detailed research plan for the query: "${query}"
      
      Output the research plan in JSON format matching this structure:
      {
        "objectives": ["objective 1", "objective 2", ...],
        "searchQueries": ["query 1", "query 2", ...],
        "relevantFactors": ["factor 1", "factor 2", ...],
        "dataGatheringStrategy": "Detailed strategy description",
        "expectedOutcomes": ["outcome 1", "outcome 2", ...]
      }
      
      Make sure to format the output as valid JSON.`,
      temperature,
    });

    // Parse the JSON response
    try {
      const parsedPlan = JSON.parse(text);
      return researchPlanSchema.parse(parsedPlan);
    } catch (parseError) {
      console.error('Failed to parse LLM response as valid JSON:', parseError);
      console.debug('Raw LLM response:', text);
      throw new Error('LLM response was not valid JSON for research plan');
    }
  } catch (error: unknown) {
    console.error('Error generating research plan with LLM:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate research plan: ${errorMessage}`);
  }
}

/**
 * Temporary function to simulate a research plan
 * This will be replaced with actual LLM calls
 */
async function simulateResearchPlan(query: string): Promise<ResearchPlan> {
  // Simulate a small delay as if we're calling an LLM
  await new Promise(resolve => setTimeout(resolve, 700));

  // Create a simulated research plan based on the query
  return {
    objectives: [
      'Identify the main aspects of the query',
      'Gather comprehensive information on the topic',
      'Find authoritative sources and recent research',
      'Analyze different perspectives and viewpoints',
    ],
    searchQueries: [
      query,
      `latest research on ${query}`,
      `${query} analysis`,
      `${query} expert opinions`,
      `${query} statistics`,
      `${query} case studies`,
    ],
    relevantFactors: [
      'Recency of information',
      'Credibility of sources',
      'Different perspectives on the topic',
      'Practical applications',
      'Historical context',
    ],
    dataGatheringStrategy: 'Use a combination of academic sources, news articles, expert blogs, and statistical databases',
    expectedOutcomes: [
      'Comprehensive understanding of the topic',
      'Identification of key trends and patterns',
      'Synthesis of different viewpoints',
      'Actionable insights based on the research',
    ],
  };
}

/**
 * Creates a planning step for the research pipeline
 * 
 * @param options Configuration options for the planning step
 * @returns A planning step for the research pipeline
 */
export function plan(options: PlanOptions = {}): ReturnType<typeof createStep> {
  return createStep('ResearchPlanning', executePlanStep, options);
}