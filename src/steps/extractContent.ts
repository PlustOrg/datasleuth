/**
 * Content extraction step for the research pipeline
 * Extracts content from URLs found in search results
 */
import { createStep } from '../utils/steps';
import { ResearchState, ExtractedContent as StateExtractedContent, SearchResult } from '../types/pipeline';
import { StepOptions } from '../types/pipeline';
import axios from 'axios';
import * as cheerio from 'cheerio';

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

  // Process each URL and extract content
  for (const result of urlsToProcess) {
    try {
      const extractedContent = await extractContentFromURL(
        result.url,
        result.title || '',
        selectors,
        maxContentLength,
        timeout,
        { 
          maxRetries: retry.maxRetries ?? 2,  // Ensure non-undefined values
          baseDelay: retry.baseDelay ?? 500
        }
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
 * Extracts content from a URL using the provided selectors
 */
async function extractContentFromURL(
  url: string,
  title: string,
  selectors: string,
  maxLength: number,
  timeout: number,
  retry: { maxRetries: number; baseDelay: number }
): Promise<StateExtractedContent> {
  let retries = 0;
  let lastError: Error | null = null;
  
  // Attempt with retries
  while (retries <= retry.maxRetries) {
    try {
      // If not the first attempt, delay based on retry count
      if (retries > 0) {
        const delayTime = retry.baseDelay * Math.pow(2, retries - 1); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayTime));
        console.log(`Retrying ${url} (attempt ${retries} of ${retry.maxRetries})...`);
      }
      
      // Fetch the content
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        maxRedirects: 5,
        validateStatus: status => status < 400 // Only allow status codes less than 400
      });
      
      // Load the HTML into cheerio
      const $ = cheerio.load(response.data);
      
      // Extract title if not provided or empty
      if (!title.trim()) {
        title = $('title').text().trim() || $('h1').first().text().trim() || url;
      }
      
      // Parse the selectors
      const selectorList = selectors.split(',').map(s => s.trim());
      const matchedSelectors: string[] = [];
      let content = '';
      
      // Try each selector until we find content
      for (const selector of selectorList) {
        const elements = $(selector);
        if (elements.length > 0) {
          // Add selector to matched list
          matchedSelectors.push(selector);
          
          // Extract text from each element
          elements.each((_, element) => {
            // Remove script and style elements
            $(element).find('script, style').remove();
            
            // Get text content
            const elementText = $(element).text().trim();
            if (elementText) {
              content += elementText + '\n\n';
            }
          });
        }
      }
      
      // If no content was found with specific selectors, try the body
      if (!content.trim()) {
        // Remove unwanted elements
        $('script, style, nav, header, footer, aside, [role=banner], [role=navigation], .sidebar').remove();
        
        // Get body text
        content = $('body').text().trim();
        matchedSelectors.push('body');
      }
      
      // Clean up content
      content = content
        .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
        .trim();
      
      // Truncate if necessary
      const finalContent = content.length > maxLength 
        ? content.substring(0, maxLength) + '...' 
        : content;
      
      // Get domain
      const domain = new URL(url).hostname;
      
      // Create timestamp
      const extractedAt = new Date().toISOString();
      
      // Calculate word count (approximate)
      const wordCount = finalContent.split(/\s+/).filter(Boolean).length;
      
      // Return the extracted content
      // Note: We're not adding metadata as it's not in the StateExtractedContent interface
      return {
        url,
        title,
        content: finalContent,
        extractionDate: extractedAt,
        selector: selectors
      };
      
    } catch (error) {
      lastError = error as Error;
      retries++;
      
      // If we've exhausted all retries, throw the last error
      if (retries > retry.maxRetries) {
        throw new Error(`Failed to extract content from ${url} after ${retry.maxRetries} retries: ${lastError.message}`);
      }
    }
  }
  
  // This should never happen due to the throw in the catch block,
  // but TypeScript requires a return statement
  throw lastError || new Error(`Failed to extract content from ${url}`);
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