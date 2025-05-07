/**
 * Web search step for the research pipeline
 * Uses @plust/search-sdk to perform web searches
 */
import { webSearch as performWebSearch } from '@plust/search-sdk';
import { createStep } from '../utils/steps';
import { ResearchState } from '../types/pipeline';
import { z } from 'zod';

// Schema for search result
const searchResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string().optional(),
  domain: z.string().optional(),
  publishedDate: z.string().optional(),
  provider: z.string().optional(),
  raw: z.any().optional(),
});

// Type for search result
export type SearchResult = z.infer<typeof searchResultSchema>;

/**
 * Options for the web search step
 */
export interface WebSearchOptions {
  /** Search provider configured from @plust/search-sdk */
  provider: any;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Language code for results (e.g., 'en') */
  language?: string;
  /** Country/region code (e.g., 'US') */
  region?: string;
  /** Content filtering level */
  safeSearch?: 'off' | 'moderate' | 'strict';
  /** Whether to use search queries from the research plan if available */
  useQueriesFromPlan?: boolean;
  /** Whether to include raw results in the state */
  includeRawResults?: boolean;
  /** Whether to include search results in the final results */
  includeInResults?: boolean;
}

/**
 * Executes web search using the provided provider
 */
async function executeWebSearchStep(
  state: ResearchState,
  options: WebSearchOptions
): Promise<ResearchState> {
  const {
    provider,
    maxResults = 10,
    language,
    region,
    safeSearch = 'moderate',
    useQueriesFromPlan = true,
    includeRawResults = false,
    includeInResults = false,
  } = options;

  // Determine which queries to use
  let queries: string[] = [state.query];
  
  // Use queries from research plan if available and option is enabled
  if (useQueriesFromPlan && state.data.researchPlan?.searchQueries) {
    queries = state.data.researchPlan.searchQueries;
  }

  // Collect all search results
  const allResults: SearchResult[] = [];
  
  // Execute each search query
  for (const query of queries) {
    try {
      const searchResults = await performWebSearch({
        query,
        maxResults,
        language,
        region,
        safeSearch,
        provider,
      });
      
      allResults.push(...searchResults);
    } catch (error) {
      console.error(`Search failed for query "${query}":`, error);
      // Continue with other queries even if one fails
    }
  }

  // Deduplicate results by URL
  const uniqueResults = allResults.filter(
    (result, index, self) => index === self.findIndex(r => r.url === result.url)
  );

  // Limit to maxResults
  const limitedResults = uniqueResults.slice(0, maxResults);

  // Remove raw property if not needed
  if (!includeRawResults) {
    limitedResults.forEach(result => {
      delete result.raw;
    });
  }

  // Update state with search results
  const newState = {
    ...state,
    data: {
      ...state.data,
      searchResults: limitedResults,
    },
  };

  // Add to results if requested
  if (includeInResults) {
    return {
      ...newState,
      results: [...newState.results, { searchResults: limitedResults }],
    };
  }

  return newState;
}

/**
 * Creates a web search step for the research pipeline
 * 
 * @param options Configuration options for the web search
 * @returns A web search step for the research pipeline
 */
export function searchWeb(options: WebSearchOptions): ReturnType<typeof createStep> {
  return createStep('WebSearch', executeWebSearchStep, options);
}