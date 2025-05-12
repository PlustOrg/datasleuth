import { BaseResearchError } from '../types/errors';
import { logger } from './logging';

/**
 * Options for the retry mechanism
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay between retries in milliseconds */
  retryDelay?: number;
  /** Factor by which to increase the delay on each subsequent retry */
  backoffFactor?: number;
  /** Function to determine if an error is retryable */
  retryableErrors?: (error: unknown) => boolean;
  /** Function to run before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>> = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffFactor: 2
};

/**
 * Default function to determine if an error is retryable
 */
const defaultIsRetryable = (error: unknown): boolean => 
  error instanceof BaseResearchError && error.retry === true;

/**
 * Default function to run before each retry attempt
 */
const defaultOnRetry = (attempt: number, error: unknown, delay: number): void => {
  logger.warn(
    `Retry attempt ${attempt} after error: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
    `Retrying in ${delay}ms...`
  );
};

/**
 * Execute a function with automatic retry for transient errors
 * 
 * This utility function wraps an asynchronous operation with retry logic that
 * can handle transient failures. It supports exponential backoff, customizable
 * retry conditions, and notifications on retry attempts.
 * 
 * @param fn - The async function to execute with retry logic
 * @param options - Retry configuration options
 * @param options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param options.retryDelay - Initial delay between retries in milliseconds (default: 1000)
 * @param options.backoffFactor - Factor by which to increase delay on each retry (default: 2)
 * @param options.retryableErrors - Function to determine if an error is retryable
 * @param options.onRetry - Function to run before each retry attempt
 * 
 * @returns The result of the function execution
 * @throws The last error encountered if all retries fail
 * 
 * @example
 * ```typescript
 * import { executeWithRetry } from '@plust/datasleuth';
 * 
 * const result = await executeWithRetry(
 *   async () => await fetchDataFromAPI(url),
 *   {
 *     maxRetries: 3,
 *     retryDelay: 1000,
 *     backoffFactor: 2,
 *     retryableErrors: (error) => {
 *       // Retry on network errors or rate limiting
 *       return error instanceof NetworkError || 
 *              (error instanceof APIError && error.status === 429);
 *     }
 *   }
 * );
 * ```
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries;
  const initialDelay = options.retryDelay ?? DEFAULT_RETRY_OPTIONS.retryDelay;
  const backoffFactor = options.backoffFactor ?? DEFAULT_RETRY_OPTIONS.backoffFactor;
  const isRetryable = options.retryableErrors ?? defaultIsRetryable;
  const onRetry = options.onRetry ?? defaultOnRetry;

  let lastError: unknown;
  let attempt = 0;
  
  // Special handling for test environment to prevent timeouts
  const shouldUseTestMode = process.env.NODE_ENV === 'test';
  
  // First attempt (attempt 0)
  try {
    return await fn();
  } catch (error) {
    lastError = error;
    
    // If not retryable or no retries allowed, rethrow immediately
    if (maxRetries <= 0 || !isRetryable(error)) {
      throw error;
    }
  }
  
  // Start retry attempts (attempt 1 and up)
  while (attempt < maxRetries) {
    attempt++;
    
    // Calculate delay with exponential backoff
    const delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
    
    // Notify about retry
    onRetry(attempt, lastError, delay);
    
    // For test environments, we avoid actual delays and just use Promise.resolve()
    // This works better with Jest's fake timers
    if (shouldUseTestMode) {
      // Just advance execution to the next microtask without actual delay
      await Promise.resolve();
    } else {
      // Use actual setTimeout for production code
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // If this error is not retryable or we've reached max retries, stop
      if (attempt >= maxRetries || !isRetryable(error)) {
        logger.debug(
          `Not retrying after error: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Reason: ${attempt >= maxRetries ? 'Max retries reached' : 'Error is not retryable'}`
        );
        throw error;
      }
    }
  }
  
  // This should never be reached due to the throw in the catch block
  // but TypeScript requires a return statement
  throw lastError;
}

/**
 * Decorator function that adds retry behavior to any async function
 * 
 * @param options Retry configuration options
 * @returns A function decorator that adds retry behavior
 */
export function withRetry(options: RetryOptions = {}) {
  return function<T extends (...args: any[]) => Promise<any>>(
    target: T
  ): ((...args: Parameters<T>) => Promise<ReturnType<T>>) {
    return async function(...args: Parameters<T>): Promise<ReturnType<T>> {
      return executeWithRetry(() => target(...args), options);
    };
  };
}