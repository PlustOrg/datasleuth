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
 * @param fn The function to execute with retry logic
 * @param options Retry configuration options
 * @returns The result of the function execution
 * @throws The last error encountered if all retries fail
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
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const shouldRetry = attempt < maxRetries && isRetryable(error);
      if (!shouldRetry) {
        logger.debug(
          `Not retrying after error: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Reason: ${attempt >= maxRetries ? 'Max retries reached' : 'Error is not retryable'}`
        );
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(backoffFactor, attempt);
      
      // Notify about retry
      onRetry(attempt + 1, error, delay);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
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