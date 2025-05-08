/**
 * Web search step for the research pipeline
 * Uses @plust/search-sdk to perform web searches
 */
import { webSearch as performWebSearch, SearchProvider as SDKSearchProvider, SearchResult as SDKSearchResult, WebSearchOptions as SDKWebSearchOptions } from '@plust/search-sdk';
import { createStep } from '../utils/steps';
import { ResearchState, SearchResult as StateSearchResult } from '../types/pipeline';
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
 * Interface for our search provider configuration
 * This is a subset of the SDK's SearchProvider interface
 */
export interface SearchProviderConfig {
  name: string;
  apiKey: string;
  cx?: string; // For Google custom search
  baseUrl?: string;
  parameters?: Record<string, string | number | boolean>;
  [key: string]: any; // Any additional provider-specific properties
}

/**
 * Options for the web search step
 */
export interface WebSearchOptions {
  /** Search provider configured from @plust/search-sdk */
  provider: SDKSearchProvider | SearchProviderConfig;
  /** Optional custom query override (if not provided, will use the main research query) */
  query?: string;
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
 * Convert our search provider config to an SDK-compatible search provider if needed
 */
function ensureSDKProvider(provider: SDKSearchProvider | SearchProviderConfig): SDKSearchProvider {
  if ('search' in provider && 'config' in provider) {
    // It's already a proper SDK provider
    return provider as SDKSearchProvider;
  }
  
  // It's our config format, create a mock SDK provider
  const config = provider as SearchProviderConfig;
  
  // Create a minimal compatible provider
  return {
    name: config.name,
    config: {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      // Spread the rest of the config properties except those already specified
      ...(({ apiKey, name, ...rest }) => rest)(config)
    },
    search: async (options) => {
      // This is just a placeholder to satisfy the type system
      // The actual search will be performed by the SDK functions
      console.warn('Mock provider search called - this should not happen in production');
      return [] as SDKSearchResult[];
    }
  };
}

/**
 * Convert SDK search results to our internal format
 */
function convertSearchResults(sdkResults: SDKSearchResult[]): StateSearchResult[] {
  return sdkResults.map(result => ({
    url: result.url,
    title: result.title,
    snippet: result.snippet,
    domain: result.domain,
    publishedDate: result.publishedDate,
    provider: result.provider,
    raw: result.raw ? result.raw as Record<string, any> : undefined
  }));
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
    query: customQuery,
    maxResults = 10,
    language,
    region,
    safeSearch = 'moderate',
    useQueriesFromPlan = true,
    includeRawResults = false,
    includeInResults = false,
  } = options;

  // Determine which queries to use
  let queries: string[] = [customQuery || state.query];
  
  // Use queries from research plan if available and option is enabled
  if (useQueriesFromPlan && state.data.researchPlan?.searchQueries) {
    const planQueries = state.data.researchPlan.searchQueries;
    // Handle the case where searchQueries might be a single string or an array
    queries = Array.isArray(planQueries) ? planQueries : [planQueries];
  }

  // Collect all search results
  const allResults: StateSearchResult[] = [];
  
  // Ensure we have a valid SDK provider
  const sdkProvider = ensureSDKProvider(provider);
  
  // Execute each search query
  for (const query of queries) {
    try {
      const searchParams: SDKWebSearchOptions = {
        query,
        maxResults,
        language,
        region,
        safeSearch,
        provider: sdkProvider
      };
      
      const searchResults = await performWebSearch(searchParams);
      
      // Convert SDK results to our internal format
      allResults.push(...convertSearchResults(searchResults));
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
  return createStep('WebSearch', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeWebSearchStep(state, options);
    }, 
    options
  );
}