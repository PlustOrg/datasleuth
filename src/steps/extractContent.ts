/**
 * Content extraction step for the research pipeline
 * Extracts content from URLs found in search results
 */
import { createStep } from '../utils/steps';
import { ResearchState, ExtractedContent as StateExtractedContent, SearchResult } from '../types/pipeline';
import { StepOptions } from '../types/pipeline';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { 
  ExtractionError, 
  NetworkError, 
  ValidationError,
  ConfigurationError 
} from '../types/errors';
import { logger, createStepLogger } from '../utils/logging';

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
  /** Minimum content length to consider a successful extraction */
  minContentLength?: number;
  /** Whether to continue if some URLs fail to extract */
  continueOnError?: boolean;
  /** Whether to require at least one successful extraction */
  requireSuccessful?: boolean;
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
  /** Extraction time in milliseconds */
  extractionTimeMs?: number;
  /** Number of retry attempts made */
  retryAttempts?: number;
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
  /** Additional metadata about the extraction */
  metadata?: ExtractedContentMetadata;
  /** Extraction date */
  extractionDate?: string;
}

/**
 * Executes content extraction from URLs in search results
 */
async function executeExtractContentStep(
  state: ResearchState,
  options: ExtractContentOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('ContentExtraction');
  
  const {
    selectors: explicitSelectors,
    selector,
    maxUrls = 5,
    maxContentLength = 10000,
    minContentLength = 100,
    includeInResults = false,
    timeout = 10000,
    retry = { maxRetries: 2, baseDelay: 500 },
    continueOnError = true,
    requireSuccessful = false
  } = options;
  
  // Use selectors if provided, otherwise use selector (alias), or fall back to default
  const selectors = explicitSelectors || selector || 'article, .content, main, #content, .article, .post';

  stepLogger.info('Starting content extraction execution');
  stepLogger.debug(`Using selectors: ${selectors}`);
  
  try {
    // Get search results from state
    const searchResults = state.data.searchResults || [];
    
    if (searchResults.length === 0) {
      stepLogger.warn('No search results found for content extraction');
      
      if (requireSuccessful) {
        throw new ValidationError({
          message: 'No search results available for content extraction',
          step: 'ContentExtraction',
          suggestions: [
            "Ensure the search step runs successfully before content extraction",
            "Check if search step is returning results",
            "Consider making this step optional if search results are not guaranteed"
          ]
        });
      }
      
      return state;
    }

    // Extract content from each URL (up to maxUrls)
    const urlsToProcess = searchResults.slice(0, maxUrls);
    const extractedContents: StateExtractedContent[] = [];
    const failedUrls: Array<{url: string; reason: string}> = [];

    stepLogger.info(`Processing ${urlsToProcess.length} URLs for content extraction`);
    
    // Process each URL and extract content
    for (const result of urlsToProcess) {
      try {
        stepLogger.debug(`Extracting content from: ${result.url}`);
        const startTime = Date.now();
        
        const extractedContent = await extractContentFromURL(
          result.url,
          result.title || '',
          selectors,
          maxContentLength,
          timeout,
          { 
            maxRetries: retry.maxRetries ?? 2,
            baseDelay: retry.baseDelay ?? 500
          },
          stepLogger
        );
        
        const extractionTime = Date.now() - startTime;
        
        // Ensure content meets minimum length requirement
        if (extractedContent.content.length < minContentLength) {
          stepLogger.warn(`Extracted content from ${result.url} is too short (${extractedContent.content.length} chars), skipping`);
          failedUrls.push({
            url: result.url,
            reason: `Content too short (${extractedContent.content.length} chars)`
          });
          continue;
        }
        
        // Add extraction time to metadata
        if (extractedContent.metadata) {
          extractedContent.metadata.extractionTimeMs = extractionTime;
        }
        
        stepLogger.info(`Successfully extracted ${extractedContent.content.length} chars from ${result.url} in ${extractionTime}ms`);
        extractedContents.push(extractedContent);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stepLogger.error(`Failed to extract content from ${result.url}: ${errorMessage}`);
        
        failedUrls.push({
          url: result.url,
          reason: errorMessage
        });
        
        // If we should not continue on error, throw
        if (!continueOnError) {
          // Determine error type for better error handling
          if (error instanceof NetworkError) {
            throw error; // Already a NetworkError
          } else if (error instanceof Error && (error.message.includes('ECONNREFUSED') || 
                                               error.message.includes('ETIMEDOUT') ||
                                               error.message.includes('network'))) {
            throw new NetworkError({
              message: `Network error extracting content from ${result.url}: ${error.message}`,
              step: 'ContentExtraction',
              details: { url: result.url, originalError: error },
              retry: true,
              suggestions: [
                "Check your internet connection",
                "Verify the URL is accessible",
                "Try increasing the timeout value",
                "The website might be blocking requests, consider using a different approach"
              ]
            });
          } else {
            // Generic extraction error
            throw new ExtractionError({
              message: `Failed to extract content from ${result.url}: ${errorMessage}`,
              step: 'ContentExtraction',
              details: { url: result.url, originalError: error },
              retry: false,
              suggestions: [
                "Check if the website structure supports content extraction",
                "Try different CSS selectors",
                "The website might be using JavaScript to render content, which simple extraction can't handle"
              ]
            });
          }
        }
      }
    }

    // Check if we have extracted any content
    if (extractedContents.length === 0 && requireSuccessful) {
      throw new ExtractionError({
        message: 'Failed to extract content from any of the provided URLs',
        step: 'ContentExtraction',
        details: { failedUrls },
        retry: false,
        suggestions: [
          "Check if the websites are accessible",
          "Try different CSS selectors",
          "The websites might be using JavaScript to render content",
          "Consider using a more robust extraction method"
        ]
      });
    }

    // Calculate statistics
    const successRate = extractedContents.length / urlsToProcess.length;
    const totalContentLength = extractedContents.reduce((sum, item) => sum + item.content.length, 0);
    const avgContentLength = extractedContents.length > 0 ? totalContentLength / extractedContents.length : 0;
    
    stepLogger.info(`Extraction complete: ${extractedContents.length}/${urlsToProcess.length} URLs successful (${(successRate * 100).toFixed(1)}%)`);
    stepLogger.debug(`Average content length: ${avgContentLength.toFixed(0)} characters`);

    // Update state with extracted content and metadata
    const newState = {
      ...state,
      data: {
        ...state.data,
        extractedContent: extractedContents,
        extractionMetadata: {
          totalProcessed: urlsToProcess.length,
          successful: extractedContents.length,
          failed: failedUrls.length,
          failedUrls,
          successRate,
          totalContentLength,
          avgContentLength,
          timestamp: new Date().toISOString()
        }
      },
    };

    // Add to results if requested
    if (includeInResults) {
      return {
        ...newState,
        results: [...newState.results, { 
          extractedContent: extractedContents,
          extractionStats: {
            successRate,
            totalContentLength,
            avgContentLength,
            successful: extractedContents.length,
            failed: failedUrls.length
          }
        }],
      };
    }

    return newState;
  } catch (error: unknown) {
    // Handle specific error types
    if (error instanceof NetworkError || error instanceof ExtractionError || error instanceof ValidationError) {
      // These are already properly formatted, just throw them
      throw error;
    } else if (error instanceof AxiosError) {
      // Format Axios errors specifically
      const status = error.response?.status;
      const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.message.includes('timeout');
      
      if (isNetworkError) {
        throw new NetworkError({
          message: `Network error during content extraction: ${error.message}`,
          step: 'ContentExtraction',
          details: { error: error, url: error.config?.url },
          retry: true,
          suggestions: [
            "Check your internet connection",
            "Verify the URLs are accessible",
            "Try increasing the timeout value"
          ]
        });
      } else if (status && status >= 400 && status < 500) {
        throw new ExtractionError({
          message: `Client error (${status}) during content extraction: ${error.message}`,
          step: 'ContentExtraction',
          details: { error: error, status, url: error.config?.url },
          retry: false,
          suggestions: [
            status === 403 ? "The website is blocking access, consider using a different approach" : 
            status === 404 ? "The URL does not exist or has been moved" :
            "Check if the URL is correct and accessible"
          ]
        });
      } else if (status && status >= 500) {
        throw new ExtractionError({
          message: `Server error (${status}) during content extraction: ${error.message}`,
          step: 'ContentExtraction',
          details: { error: error, status, url: error.config?.url },
          retry: true,
          suggestions: [
            "The website server is experiencing issues",
            "Try again later",
            "Consider using a different source for information"
          ]
        });
      }
    }
    
    // Generic error handling
    throw new ExtractionError({
      message: `Error during content extraction: ${error instanceof Error ? error.message : String(error)}`,
      step: 'ContentExtraction',
      details: { originalError: error },
      retry: false,
      suggestions: [
        "Check configuration parameters",
        "Verify URL formats",
        "Inspect the error details for more specific guidance"
      ]
    });
  }
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
  retry: { maxRetries: number; baseDelay: number },
  stepLogger: ReturnType<typeof createStepLogger>
): Promise<StateExtractedContent> {
  let retries = 0;
  let lastError: Error | null = null;
  
  // Validate URL
  try {
    new URL(url); // Will throw if invalid
  } catch (error) {
    throw new ValidationError({
      message: `Invalid URL format: ${url}`,
      step: 'ContentExtraction',
      details: { url, error },
      suggestions: [
        "Check URL format, must be a valid absolute URL",
        "Ensure URL includes protocol (http:// or https://)"
      ]
    });
  }
  
  // Attempt with retries
  while (retries <= retry.maxRetries) {
    try {
      // If not the first attempt, delay based on retry count
      if (retries > 0) {
        const delayTime = retry.baseDelay * Math.pow(2, retries - 1); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayTime));
        stepLogger.debug(`Retrying ${url} (attempt ${retries} of ${retry.maxRetries}, delay: ${delayTime}ms)...`);
      }
      
      // Fetch the content
      const startFetch = Date.now();
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
      const fetchTime = Date.now() - startFetch;
      
      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('html') && !contentType.includes('text')) {
        throw new ExtractionError({
          message: `Unsupported content type: ${contentType}`,
          step: 'ContentExtraction',
          details: { url, contentType },
          suggestions: [
            "This URL points to non-HTML content that cannot be extracted",
            "Try a different URL that contains HTML content"
          ]
        });
      }
      
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
      const isComplete = content.length <= maxLength;
      const finalContent = content.length > maxLength 
        ? content.substring(0, maxLength) + '...' 
        : content;
      
      // Get domain
      const domain = new URL(url).hostname;
      
      // Create timestamp
      const extractedAt = new Date().toISOString();
      
      // Calculate word count (approximate)
      const wordCount = finalContent.split(/\s+/).filter(Boolean).length;
      
      // Create metadata
      const metadata: ExtractedContentMetadata = {
        wordCount,
        domain,
        statusCode: response.status,
        contentType: response.headers['content-type'],
        extractedAt,
        matchedSelectors,
        isComplete,
        retryAttempts: retries
      };
      
      // Return the extracted content with proper metadata
      return {
        url,
        title,
        content: finalContent,
        metadata,
        extractionDate: extractedAt  // Add the extractionDate field to match the pipeline.ts interface
      };
      
    } catch (error) {
      lastError = error as Error;
      retries++;
      
      // Log retry information
      if (retries <= retry.maxRetries) {
        stepLogger.warn(`Extraction attempt ${retries} failed for ${url}: ${lastError.message}`);
      }
      
      // If we've exhausted all retries, format and throw appropriate error
      if (retries > retry.maxRetries) {
        if (error instanceof AxiosError) {
          if (!error.response || error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            throw new NetworkError({
              message: `Network error fetching ${url} after ${retry.maxRetries} retries: ${lastError.message}`,
              step: 'ContentExtraction',
              details: { url, error, attempts: retries },
              retry: true,
              suggestions: [
                "Check your internet connection",
                "The website may be temporarily unavailable",
                "Try increasing the timeout value",
                "Consider using a different URL"
              ]
            });
          } else if (error.response && error.response.status >= 400) {
            throw new ExtractionError({
              message: `HTTP error (${error.response.status}) fetching ${url} after ${retry.maxRetries} retries`,
              step: 'ContentExtraction',
              details: { url, status: error.response.status, error },
              retry: error.response.status >= 500, // Server errors can be retried, client errors usually can't
              suggestions: [
                error.response.status === 403 ? "The website is blocking access, consider using a different source" :
                error.response.status === 404 ? "The URL does not exist or has been moved" :
                error.response.status >= 500 ? "The website server is experiencing issues, try again later" :
                "Check if the URL is correct and accessible"
              ]
            });
          }
        }
        
        // For other errors, use a generic ExtractionError
        throw new ExtractionError({
          message: `Failed to extract content from ${url} after ${retry.maxRetries} retries: ${lastError.message}`,
          step: 'ContentExtraction',
          details: { url, error: lastError, attempts: retries },
          retry: false,
          suggestions: [
            "Try different CSS selectors",
            "The website might be using JavaScript to render content",
            "Consider using a more robust extraction method"
          ]
        });
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
  return createStep(
    'ContentExtraction', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: StepOptions) => {
      return executeExtractContentStep(state, options);
    }, 
    options,
    {
      // Mark as retryable by default for the entire step
      retryable: true,
      maxRetries: options.retry?.maxRetries || 2,
      retryDelay: options.retry?.baseDelay || 500,
      backoffFactor: 2,
      // Mark as optional unless explicitly required
      optional: !options.requireSuccessful
    }
  );
}