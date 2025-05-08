import { ErrorCode } from './errorCodes';

/**
 * Base Research Error interface implemented by all specialized error classes
 */
export interface ResearchError extends Error {
  /** Error code identifying the specific type of error */
  code: ErrorCode;
  /** The pipeline step where the error occurred */
  step?: string;
  /** Additional details about the error for debugging */
  details?: Record<string, unknown>;
  /** Whether this error should be automatically retried */
  retry?: boolean;
  /** Suggestions for fixing or working around the error */
  suggestions?: string[];
}

/**
 * Base implementation for all specialized research error classes
 */
export class BaseResearchError extends Error implements ResearchError {
  code: ErrorCode;
  step?: string;
  details?: Record<string, unknown>;
  retry: boolean;
  suggestions: string[];

  constructor(options: {
    message: string;
    code: ErrorCode;
    step?: string;
    details?: Record<string, unknown>;
    retry?: boolean;
    suggestions?: string[];
  }) {
    super(options.message);
    this.name = 'ResearchError';
    this.code = options.code;
    this.step = options.step;
    this.details = options.details;
    this.retry = options.retry ?? false;
    this.suggestions = options.suggestions ?? [];
    
    // Maintain proper stack traces for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Creates a formatted error message with details for logging
   */
  getFormattedMessage(): string {
    let message = `[${this.code}] ${this.message}`;
    
    if (this.step) {
      message = `[Step: ${this.step}] ${message}`;
    }
    
    if (this.suggestions && this.suggestions.length > 0) {
      message += `\nSuggestions:\n${this.suggestions.map(s => `- ${s}`).join('\n')}`;
    }
    
    return message;
  }
}

/**
 * Error thrown when there are issues with the research configuration
 */
export class ConfigurationError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'>) {
    super({ ...options, code: 'configuration_error' });
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when input or output validation fails
 */
export class ValidationError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'>) {
    super({ ...options, code: 'validation_error' });
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when network operations fail
 */
export class NetworkError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'> & { retry?: boolean }) {
    super({ ...options, code: 'network_error', retry: options.retry ?? true });
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when external API calls fail
 */
export class ApiError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'> & { 
    retry?: boolean;
    statusCode?: number;
  }) {
    super({ 
      ...options, 
      code: 'api_error', 
      retry: options.retry ?? false,
      details: { 
        ...options.details,
        statusCode: options.statusCode 
      }
    });
    this.name = 'ApiError';
  }
}

/**
 * Error thrown when LLM operations fail
 */
export class LLMError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'> & { retry?: boolean }) {
    super({ ...options, code: 'llm_error', retry: options.retry ?? true });
    this.name = 'LLMError';
  }
}

/**
 * Error thrown when search operations fail
 */
export class SearchError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'> & { retry?: boolean }) {
    super({ ...options, code: 'search_error', retry: options.retry ?? true });
    this.name = 'SearchError';
  }
}

/**
 * Error thrown when content extraction fails
 */
export class ExtractionError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'>) {
    super({ ...options, code: 'extraction_error' });
    this.name = 'ExtractionError';
  }
}

/**
 * Error thrown when pipeline execution fails
 */
export class PipelineError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'>) {
    super({ ...options, code: 'pipeline_error' });
    this.name = 'PipelineError';
  }
}

/**
 * Type guard to check if an error is a ResearchError
 */
export function isResearchError(error: unknown): error is ResearchError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as any).code === 'string'
  );
}

/**
 * Type guard to check if an error is a NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Type guard to check if an error is an LLMError
 */
export function isLLMError(error: unknown): error is LLMError {
  return error instanceof LLMError;
}

/**
 * Type guard to check if an error is a SearchError
 */
export function isSearchError(error: unknown): error is SearchError {
  return error instanceof SearchError;
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is a ConfigurationError
 */
export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return isResearchError(error) && error.retry === true;
}