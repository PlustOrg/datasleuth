/**
 * Web search step for the research pipeline
 * Uses @plust/search-sdk to perform web searches
 */
import { webSearch as performWebSearch, SearchProvider as SDKSearchProvider, SearchResult as SDKSearchResult, WebSearchOptions as SDKWebSearchOptions } from '@plust/search-sdk';
import { createStep } from '../utils/steps';
import { ResearchState, SearchResult as StateSearchResult } from '../types/pipeline';
import { z } from 'zod';
import { 
  SearchError, 
  NetworkError, 
  ConfigurationError,
  ValidationError
} from '../types/errors';
import { logger, createStepLogger } from '../utils/logging';

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
  /** Maximum retry attempts for search requests */
  maxRetries?: number;
  /** Whether to require at least one successful search */
  requireResults?: boolean;
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
  
  if (!config.apiKey) {
    throw new ConfigurationError({
      message: `Missing API key for search provider "${config.name}"`,
      step: 'WebSearch',
      suggestions: [
        "Provide an API key in the provider configuration",
        "Check environment variables for API keys",
        "Use a different search provider with valid credentials"
      ]
    });
  }
  
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
      logger.warn('Mock provider search called - this should not happen in production');
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
 * Validate search query
 */
function validateQuery(query: string): string {
  // Remove any potentially problematic characters and excessive whitespace
  const cleanedQuery = query.trim();
  
  if (!cleanedQuery) {
    throw new ValidationError({
      message: 'Invalid search query: Empty or whitespace only',
      step: 'WebSearch',
      suggestions: [
        "Provide a non-empty search query",
        "Check if query generation is functioning correctly"
      ]
    });
  }
  
  if (cleanedQuery.length > 2000) {
    throw new ValidationError({
      message: `Search query too long (${cleanedQuery.length} chars)`,
      step: 'WebSearch',
      suggestions: [
        "Shorten the search query to under 2000 characters",
        "Split long queries into multiple smaller queries"
      ]
    });
  }
  
  return cleanedQuery;
}

/**
 * Executes web search using the provided provider
 */
async function executeWebSearchStep(
  state: ResearchState,
  options: WebSearchOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('WebSearch');
  
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
    requireResults = false
  } = options;

  stepLogger.info('Starting web search execution');
  
  try {
    // Determine which queries to use
    let queries: string[] = [];
    
    if (customQuery) {
      // If a custom query is provided, use it
      queries.push(validateQuery(customQuery));
    } else if (useQueriesFromPlan && state.data.researchPlan?.searchQueries) {
      // Use queries from research plan if available and option is enabled
      const planQueries = state.data.researchPlan.searchQueries;
      
      // Handle the case where searchQueries might be a single string or an array
      if (Array.isArray(planQueries)) {
        queries = planQueries.map(q => validateQuery(q)).filter(Boolean);
      } else if (typeof planQueries === 'string') {
        queries = [validateQuery(planQueries)];
      }
      
      stepLogger.debug(`Using ${queries.length} queries from research plan`);
    }
    
    // If we still don't have any valid queries, use the main research query
    if (queries.length === 0) {
      queries = [validateQuery(state.query)];
      stepLogger.debug('Using main research query');
    }

    // Ensure we have a valid SDK provider
    let sdkProvider: SDKSearchProvider;
    try {
      sdkProvider = ensureSDKProvider(provider);
      stepLogger.debug(`Using search provider: ${sdkProvider.name}`);
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error; // Already formatted correctly
      }
      throw new ConfigurationError({
        message: `Invalid search provider configuration: ${error instanceof Error ? error.message : String(error)}`,
        step: 'WebSearch',
        details: { error },
        suggestions: [
          "Check provider name and API key",
          "Ensure you're using a supported search provider",
          "Verify the structure of your provider configuration"
        ]
      });
    }

    // Collect all search results
    const allResults: StateSearchResult[] = [];
    const errors: Error[] = [];
    
    // Track successful searches
    let successfulSearches = 0;
    
    // Execute each search query
    stepLogger.info(`Executing ${queries.length} search queries`);
    
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
        
        stepLogger.debug(`Searching for: "${query}"`);
        const searchResults = await performWebSearch(searchParams);
        
        // Convert SDK results to our internal format
        const convertedResults = convertSearchResults(searchResults);
        
        if (convertedResults.length > 0) {
          successfulSearches++;
          stepLogger.info(`Query "${query}" returned ${convertedResults.length} results`);
          allResults.push(...convertedResults);
        } else {
          stepLogger.warn(`Query "${query}" returned no results`);
        }
      } catch (error: unknown) {
        // Format the error but continue with other queries
        const errorMessage = error instanceof Error ? error.message : String(error);
        stepLogger.error(`Search failed for query "${query}": ${errorMessage}`);
        
        // Add structured error for debugging
        if (error instanceof Error) {
          errors.push(error);
        } else {
          errors.push(new Error(`Unknown error: ${String(error)}`));
        }
      }
    }

    // Check if we have any results at all
    if (allResults.length === 0) {
      if (requireResults) {
        // If results are required, throw an error
        throw new SearchError({
          message: 'No search results found for any queries',
          step: 'WebSearch',
          details: { 
            queries,
            errors: errors.map(e => e.message)
          },
          retry: true,
          suggestions: [
            "Try different search queries",
            "Check if the search provider is working correctly",
            "Verify API keys and rate limits",
            "Consider using a different search provider"
          ]
        });
      } else {
        // Otherwise just log a warning
        stepLogger.warn('No search results found for any queries, continuing anyway');
      }
    }

    // Deduplicate results by URL
    const uniqueResults = allResults.filter(
      (result, index, self) => index === self.findIndex(r => r.url === result.url)
    );
    stepLogger.debug(`Deduplicated ${allResults.length} results to ${uniqueResults.length} unique URLs`);

    // Limit to maxResults
    const limitedResults = uniqueResults.slice(0, maxResults);
    if (uniqueResults.length > maxResults) {
      stepLogger.debug(`Limited to ${maxResults} results (dropped ${uniqueResults.length - maxResults})`);
    }

    // Remove raw property if not needed
    if (!includeRawResults) {
      limitedResults.forEach(result => {
        delete result.raw;
      });
    }

    // Log information about found results
    stepLogger.info(`Found ${limitedResults.length} search results after processing`);

    // Update state with search results
    const newState = {
      ...state,
      data: {
        ...state.data,
        searchResults: limitedResults,
        searchMetadata: {
          successfulQueries: successfulSearches,
          totalQueries: queries.length,
          provider: sdkProvider.name,
          timestamp: new Date().toISOString(),
          ...(errors.length > 0 ? { errors: errors.map(e => e.message) } : {})
        }
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
  } catch (error: unknown) {
    // Handle different error types
    if (error instanceof ConfigurationError || error instanceof ValidationError || error instanceof SearchError) {
      // These are already properly formatted, just throw them
      throw error;
    } else if (error instanceof Error && error.message.includes('network')) {
      // Handle network errors specifically
      throw new NetworkError({
        message: `Network error during web search: ${error.message}`,
        step: 'WebSearch',
        details: { originalError: error },
        retry: true,
        suggestions: [
          "Check your internet connection",
          "Verify the search provider's API endpoint is accessible",
          "Try again later if this might be a temporary issue"
        ]
      });
    } else {
      // Generic error handling
      throw new SearchError({
        message: `Error during web search: ${error instanceof Error ? error.message : String(error)}`,
        step: 'WebSearch',
        details: { originalError: error },
        retry: true,
        suggestions: [
          "Check search provider configuration",
          "Verify API key is valid and has sufficient permissions",
          "Check query format and content",
          "Inspect the error details for more specific guidance"
        ]
      });
    }
  }
}

/**
 * Creates a web search step for the research pipeline
 * 
 * @param options Configuration options for the web search
 * @returns A web search step for the research pipeline
 */
export function searchWeb(options: WebSearchOptions): ReturnType<typeof createStep> {
  return createStep(
    'WebSearch', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeWebSearchStep(state, options);
    }, 
    options,
    {
      // Mark as retryable by default
      retryable: true,
      maxRetries: options.maxRetries || 3,
      retryDelay: 2000,
      backoffFactor: 2
    }
  );
}