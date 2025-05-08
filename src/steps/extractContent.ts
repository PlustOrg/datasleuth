/**
 * Content extraction step for the research pipeline
 * Extracts content from URLs found in search results
 */
import { createStep } from '../utils/steps';
import { ResearchState, ExtractedContent as StateExtractedContent, SearchResult } from '../types/pipeline';
import { StepOptions } from '../types/pipeline';

/**
 * Options for the content extraction step
 */
export interface ExtractContentOptions extends StepOptions {
  /** CSS selectors to extract content from */
  selectors?: string;
  /** Alias for selectors (for backwards compatibility) */
  selector?: string;
  /** Maximum number of URLs to process */
  maxUrls?: number;
  /** Maximum content length per URL (characters) */
  maxContentLength?: number;
  /** Whether to include the extracted content in the final results */
  includeInResults?: boolean;
  /** Timeout for each URL fetch in milliseconds */
  timeout?: number;
  /** Fetch retry configuration */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Interface for extracted content metadata
 */
export interface ExtractedContentMetadata {
  /** Approximate word count in the content */
  wordCount: number;
  /** Domain of the source website */
  domain: string;
  /** HTTP status code of the response */
  statusCode: number;
  /** MIME type of the content */
  contentType?: string;
  /** Extraction timestamp */
  extractedAt: string;
  /** Which selectors matched and were used */
  matchedSelectors?: string[];
  /** Was this a complete extraction or partial */
  isComplete?: boolean;
}

/**
 * Interface for extracted content
 */
export interface ExtractedContent {
  /** URL of the extracted content */
  url: string;
  /** Title of the content */
  title: string;
  /** The extracted text content */
  content: string;
  /** ISO timestamp of when the content was extracted */
  extractedAt: string;
  /** Additional metadata about the extraction */
  metadata?: ExtractedContentMetadata;
}

/**
 * Executes content extraction from URLs in search results
 */
async function executeExtractContentStep(
  state: ResearchState,
  options: ExtractContentOptions
): Promise<ResearchState> {
  const {
    selectors: explicitSelectors,
    selector,
    maxUrls = 5,
    maxContentLength = 10000,
    includeInResults = false,
    timeout = 10000,
    retry = { maxRetries: 2, baseDelay: 500 },
  } = options;
  
  // Use selectors if provided, otherwise use selector (alias), or fall back to default
  const selectors = explicitSelectors || selector || 'article, .content, main, #content, .article, .post';

  // Get search results from state
  const searchResults = state.data.searchResults || [];
  
  if (searchResults.length === 0) {
    console.warn('No search results found for content extraction');
    return state;
  }

  // Extract content from each URL (up to maxUrls)
  const urlsToProcess = searchResults.slice(0, maxUrls);
  const extractedContents: StateExtractedContent[] = [];

  // For now, simulate content extraction
  // In a real implementation, this would use fetch and a DOM parser
  for (const result of urlsToProcess) {
    try {
      const extractedContent = await simulateContentExtraction(
        result.url,
        result.title || '',
        selectors,
        maxContentLength
      );
      
      extractedContents.push(extractedContent);
    } catch (error) {
      console.error(`Failed to extract content from ${result.url}:`, error);
    }
  }

  // Update state with extracted content
  const newState = {
    ...state,
    data: {
      ...state.data,
      extractedContent: extractedContents,
    },
  };

  // Add to results if requested
  if (includeInResults) {
    return {
      ...newState,
      results: [...newState.results, { extractedContent: extractedContents }],
    };
  }

  return newState;
}

/**
 * Temporary function to simulate content extraction
 * This will be replaced with actual web scraping in the full implementation
 */
async function simulateContentExtraction(
  url: string,
  title: string,
  selectors: string,
  maxLength: number
): Promise<StateExtractedContent> {
  // Simulate a delay as if we're fetching and parsing content
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
  
  // For simulation, create content based on the URL and title
  const domain = new URL(url).hostname;
  
  // Generate simulated content
  const contentLength = Math.min(1000 + Math.floor(Math.random() * 5000), maxLength);
  let content = `This is simulated content extracted from ${domain}. `;
  content += `The page title is "${title}". `;
  content += `The content was extracted using selectors: ${selectors}. `;
  content += `Here's some more simulated content to reach the desired length... `;
  
  // Pad content to reach contentLength
  while (content.length < contentLength) {
    content += `The topic of this page appears to be related to ${title.toLowerCase()}. `;
    content += `Various facts and information about this topic would be presented here. `;
  }
  
  // Trim to max length
  content = content.substring(0, maxLength);

  const extractedAt = new Date().toISOString();

  return {
    url,
    title,
    content,
    extractionDate: extractedAt,
    selector: selectors
  };
}

/**
 * Creates a content extraction step for the research pipeline
 * 
 * @param options Configuration options for content extraction
 * @returns A content extraction step for the research pipeline
 */
export function extractContent(options: ExtractContentOptions = {}): ReturnType<typeof createStep> {
  return createStep('ContentExtraction', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: StepOptions) => {
      return executeExtractContentStep(state, options);
    }, 
    options
  );
}