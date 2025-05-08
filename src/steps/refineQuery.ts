/**
 * Query refinement step for the research pipeline
 * Improves search queries based on previous findings
 */
import * as mastra from 'mastra';
import { createStep } from '../utils/steps';
import { ResearchState } from '../types/pipeline';
import { z } from 'zod';

/**
 * Schema for refined query output
 */
const refinedQuerySchema = z.object({
  originalQuery: z.string(),
  refinedQuery: z.string(),
  refinementStrategy: z.string(),
  targetedAspects: z.array(z.string()).optional(),
  reasonForRefinement: z.string().optional(),
});

export type RefinedQuery = z.infer<typeof refinedQuerySchema>;

/**
 * Options for the query refinement step
 */
export interface RefineQueryOptions {
  /** What to base the refinement on */
  basedOn?: 'findings' | 'gaps' | 'factuality' | 'all';
  /** Model to use for query refinement */
  model?: any;
  /** Maximum number of queries to generate */
  maxQueries?: number;
  /** Whether to include the refined queries in the final results */
  includeInResults?: boolean;
  /** Custom prompt for query refinement */
  customPrompt?: string;
  /** Temperature for the LLM (0.0 to 1.0) */
  temperature?: number;
}

/**
 * Default query refinement prompt
 */
const DEFAULT_REFINE_QUERY_PROMPT = `
You are an expert research query optimizer. Your task is to refine a search query based on initial findings.

Analyze the search results and current research state to identify:
1. Information gaps that need to be addressed
2. Promising avenues for deeper exploration
3. Areas where the initial query was too broad or too narrow
4. Specific details that require clarification or verification

Create refined queries that will yield more relevant, comprehensive, or accurate information.
Explain the reasoning behind each refinement.
`;

/**
 * Executes query refinement based on research findings
 */
async function executeRefineQueryStep(
  state: ResearchState,
  options: RefineQueryOptions
): Promise<ResearchState> {
  const {
    basedOn = 'all',
    maxQueries = 3,
    includeInResults = false,
    temperature = 0.7,
  } = options;

  console.log(`Refining query based on: ${basedOn}`);
  
  // Get relevant information from state based on refinement strategy
  const relevantData: Record<string, any> = {
    originalQuery: state.query,
  };
  
  if (basedOn === 'findings' || basedOn === 'all') {
    relevantData.extractedContent = state.data.extractedContent || [];
    relevantData.searchResults = state.data.searchResults || [];
  }
  
  if (basedOn === 'gaps' || basedOn === 'all') {
    relevantData.researchPlan = state.data.researchPlan || {};
    // Identify information that's missing compared to research plan
  }
  
  if (basedOn === 'factuality' || basedOn === 'all') {
    relevantData.factChecks = state.data.factChecks || [];
    // Focus on areas where factuality is low or contradictory
  }
  
  // For now, simulate query refinement
  // In a real implementation, this would use an LLM to generate refined queries
  const refinedQueries = await simulateQueryRefinement(
    state.query,
    basedOn,
    relevantData,
    maxQueries
  );
  
  // Update state with refined queries
  const newState = {
    ...state,
    data: {
      ...state.data,
      refinedQueries,
    },
  };

  // Add to results if requested
  if (includeInResults) {
    return {
      ...newState,
      results: [...newState.results, { refinedQueries }],
    };
  }

  return newState;
}

/**
 * Simulates query refinement using an LLM
 * In a real implementation, this would call an actual LLM
 */
async function simulateQueryRefinement(
  originalQuery: string,
  strategy: string,
  relevantData: Record<string, any>,
  maxQueries: number
): Promise<RefinedQuery[]> {
  // Simulate a delay as if we're calling an LLM
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Generate simulated refined queries based on the strategy
  const refinedQueries: RefinedQuery[] = [];
  
  if (strategy === 'findings' || strategy === 'all') {
    // Refine based on extracted content and search results
    refinedQueries.push({
      originalQuery,
      refinedQuery: `${originalQuery} recent developments`,
      refinementStrategy: 'time-focused',
      targetedAspects: ['recency', 'current state'],
      reasonForRefinement: 'Initial findings lack recent information. Adding time context to focus on newest developments.',
    });
    
    refinedQueries.push({
      originalQuery,
      refinedQuery: `${originalQuery} analysis comparison`,
      refinementStrategy: 'analytical-depth',
      targetedAspects: ['analysis', 'comparison'],
      reasonForRefinement: 'Initial results contain factual information but lack analytical depth. Adding analysis focus to get comparative insights.',
    });
  }
  
  if (strategy === 'gaps' || strategy === 'all') {
    // Refine based on research plan and identified gaps
    const keywords = originalQuery.split(' ');
    if (keywords.length > 2) {
      const specificTerm = keywords[Math.floor(Math.random() * keywords.length)];
      refinedQueries.push({
        originalQuery,
        refinedQuery: `${specificTerm} in context of ${originalQuery}`,
        refinementStrategy: 'deeper-focus',
        targetedAspects: ['specific-component', 'depth'],
        reasonForRefinement: `Initial results lack depth on ${specificTerm}. Focusing specifically on this aspect to fill information gap.`,
      });
    }
  }
  
  if (strategy === 'factuality' || strategy === 'all') {
    // Refine based on factuality issues
    refinedQueries.push({
      originalQuery,
      refinedQuery: `${originalQuery} evidence research papers`,
      refinementStrategy: 'credibility-enhancement',
      targetedAspects: ['credibility', 'evidence', 'academic'],
      reasonForRefinement: 'Some facts in initial results need better verification. Targeting academic and research sources for higher factual accuracy.',
    });
  }
  
  // Ensure we don't exceed the max number of queries
  return refinedQueries.slice(0, maxQueries);
}

/**
 * Creates a query refinement step for the research pipeline
 * 
 * @param options Configuration options for query refinement
 * @returns A query refinement step for the research pipeline
 */
export function refineQuery(options: RefineQueryOptions = {}): ReturnType<typeof createStep> {
  return createStep('RefineQuery', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeRefineQueryStep(state, options);
    }, 
    options
  );
}