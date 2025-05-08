# Error Handling Enhancement Plan for @plust/deep-restruct

This document outlines the comprehensive plan for enhancing error handling in the @plust/deep-restruct package.

## Goals

1. Create a robust, consistent error handling system across all pipeline steps
2. Provide detailed, actionable error messages for debugging
3. Implement retry mechanisms for transient failures
4. Add proper logging with configurable verbosity levels
5. Ensure all errors are properly typed and categorized
6. Gracefully handle failures without crashing the entire pipeline

## Implementation Strategy

### 1. Error Class Hierarchy

Create a specialized error class hierarchy:

```typescript
// Base Research Error interface
export interface ResearchError extends Error {
  code: ErrorCode;
  step?: string;
  details?: Record<string, unknown>;
  retry?: boolean;
  suggestions?: string[];
}

// Base Error Implementation
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
  }
}
```

### 2. Specialized Error Classes

Implement specialized error classes for different error types:

```typescript
// Configuration errors
export class ConfigurationError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'>) {
    super({ ...options, code: 'configuration_error' });
    this.name = 'ConfigurationError';
  }
}

// Validation errors
export class ValidationError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'>) {
    super({ ...options, code: 'validation_error' });
    this.name = 'ValidationError';
  }
}

// Network errors
export class NetworkError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'> & { retry?: boolean }) {
    super({ ...options, code: 'network_error', retry: options.retry ?? true });
    this.name = 'NetworkError';
  }
}

// API errors
export class ApiError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'> & { retry?: boolean }) {
    super({ ...options, code: 'api_error', retry: options.retry ?? false });
    this.name = 'ApiError';
  }
}

// LLM errors
export class LLMError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'> & { retry?: boolean }) {
    super({ ...options, code: 'llm_error', retry: options.retry ?? true });
    this.name = 'LLMError';
  }
}

// Search errors
export class SearchError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'> & { retry?: boolean }) {
    super({ ...options, code: 'search_error', retry: options.retry ?? true });
    this.name = 'SearchError';
  }
}

// Content extraction errors
export class ExtractionError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'>) {
    super({ ...options, code: 'extraction_error' });
    this.name = 'ExtractionError';
  }
}

// Pipeline execution errors
export class PipelineError extends BaseResearchError {
  constructor(options: Omit<ConstructorParameters<typeof BaseResearchError>[0], 'code'>) {
    super({ ...options, code: 'pipeline_error' });
    this.name = 'PipelineError';
  }
}
```

### 3. Error Codes

Define comprehensive error codes for specific failure scenarios:

```typescript
export type ErrorCode =
  // Configuration errors
  | 'configuration_error'
  | 'invalid_options'
  | 'missing_required_option'
  | 'invalid_provider'
  
  // Validation errors
  | 'validation_error'
  | 'schema_validation_error'
  | 'invalid_output_format'
  
  // Network errors
  | 'network_error'
  | 'request_timeout'
  | 'connection_error'
  
  // API errors
  | 'api_error'
  | 'rate_limited'
  | 'authentication_error'
  | 'quota_exceeded'
  
  // LLM errors
  | 'llm_error'
  | 'prompt_too_large'
  | 'context_limit_exceeded'
  | 'content_policy_violation'
  
  // Search errors
  | 'search_error'
  | 'no_results_found'
  | 'invalid_search_query'
  
  // Content extraction errors
  | 'extraction_error'
  | 'selector_not_found'
  | 'invalid_content_format'
  
  // Pipeline execution errors
  | 'pipeline_error'
  | 'step_execution_error'
  | 'parallel_execution_error'
  | 'step_timeout'

  // Generic errors
  | 'unknown_error'
  | 'not_implemented';
```

### 4. Error Handling Strategy

#### 4.1 Step-Level Error Handling

Enhance each step with consistent error handling:

```typescript
export function executeStepWithErrorHandling<T extends Record<string, unknown>>(
  step: ResearchStep,
  state: ResearchState,
  options: T
): Promise<ResearchState> {
  try {
    return step.execute(state, options);
  } catch (error: unknown) {
    // Handle different error types
    if (error instanceof BaseResearchError) {
      // Already a research error, just throw it
      throw error;
    } else if (error instanceof Error) {
      // Convert generic Error to BaseResearchError
      throw new BaseResearchError({
        message: error.message,
        code: 'unknown_error',
        step: step.name,
        details: { originalError: error }
      });
    } else {
      // Handle non-Error objects
      throw new BaseResearchError({
        message: 'An unknown error occurred',
        code: 'unknown_error',
        step: step.name,
        details: { originalError: error }
      });
    }
  }
}
```

#### 4.2 Retry Mechanism

Implement retry logic for transient errors:

```typescript
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    backoffFactor?: number;
    retryableErrors?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const retryDelay = options.retryDelay ?? 1000;
  const backoffFactor = options.backoffFactor ?? 2;
  const retryableErrors = options.retryableErrors ?? 
    ((error: unknown) => error instanceof BaseResearchError && error.retry);

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !retryableErrors(error)) {
        throw error;
      }
      const delay = retryDelay * Math.pow(backoffFactor, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached due to the throw in the catch block
  // but TypeScript requires a return statement
  throw lastError;
}
```

#### 4.3 Pipeline Error Handling

Enhance the pipeline execution with graceful error handling:

```typescript
export async function executePipeline(
  steps: ResearchStep[],
  initialState: ResearchState,
  options: PipelineOptions = {}
): Promise<ResearchState> {
  let currentState = initialState;
  const errors: Array<{ step: string; error: BaseResearchError }> = [];
  
  for (const step of steps) {
    try {
      // Add possible retry logic here for retryable steps
      if (step.retryable && options.enableRetry !== false) {
        currentState = await executeWithRetry(
          () => step.execute(currentState, step.options),
          {
            maxRetries: options.maxRetries ?? 3,
            retryDelay: options.retryDelay ?? 1000
          }
        );
      } else {
        currentState = await step.execute(currentState, step.options);
      }
    } catch (error: unknown) {
      const researchError = error instanceof BaseResearchError 
        ? error 
        : new BaseResearchError({
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'step_execution_error',
            step: step.name
          });

      errors.push({ step: step.name, error: researchError });
      
      // Log the error for debugging
      logger.error(`Error in step ${step.name}:`, researchError);
      
      if (options.continueOnError) {
        // Add error to state metadata but continue with next step
        currentState = {
          ...currentState,
          metadata: {
            ...currentState.metadata,
            errors: [...(currentState.metadata.errors || []), researchError]
          }
        };
      } else {
        // Throw and stop the pipeline
        throw new PipelineError({
          message: `Pipeline execution failed at step "${step.name}": ${researchError.message}`,
          step: step.name,
          details: { originalError: researchError }
        });
      }
    }
  }
  
  // Return final state with any accumulated errors in metadata
  return currentState;
}
```

### 5. Logging System

Implement a configurable logging system:

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  includeTimestamp?: boolean;
  includeStepName?: boolean;
  logToConsole?: boolean;
  customLoggers?: Array<(level: LogLevel, message: string, ...args: unknown[]) => void>;
}

export class Logger {
  private level: LogLevel;
  private options: LoggerOptions;
  
  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.options = {
      includeTimestamp: true,
      includeStepName: true,
      logToConsole: true,
      ...options
    };
  }
  
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }
  
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }
  
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }
  
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }
  
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;
    
    const formattedMessage = this.formatMessage(level, message);
    
    if (this.options.logToConsole) {
      console[level](formattedMessage, ...args);
    }
    
    if (this.options.customLoggers) {
      for (const logger of this.options.customLoggers) {
        logger(level, formattedMessage, ...args);
      }
    }
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    return levels[level] >= levels[this.level];
  }
  
  private formatMessage(level: LogLevel, message: string): string {
    let formattedMessage = message;
    
    if (this.options.includeTimestamp) {
      formattedMessage = `[${new Date().toISOString()}] ${formattedMessage}`;
    }
    
    if (this.options.includeStepName && getCurrentStepName()) {
      formattedMessage = `[${getCurrentStepName()}] ${formattedMessage}`;
    }
    
    return `[${level.toUpperCase()}] ${formattedMessage}`;
  }
}

// Global logger instance
export const logger = new Logger();

// Helper to get current step name from context
function getCurrentStepName(): string | undefined {
  // Implementation depends on how context is maintained throughout pipeline execution
  // Could be from a global variable, async storage, or passed context object
  return undefined; // Placeholder
}
```

### 6. Type Guards

Implement type guards for better error handling:

```typescript
// Type guard for ResearchError
export function isResearchError(error: unknown): error is ResearchError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error instanceof Error
  );
}

// Type guard for specific error types
export function isNetworkError(error: unknown): error is NetworkError {
  return isResearchError(error) && error instanceof NetworkError;
}

export function isApiError(error: unknown): error is ApiError {
  return isResearchError(error) && error instanceof ApiError;
}

// Type guard to check if an error is retryable
export function isRetryableError(error: unknown): boolean {
  return isResearchError(error) && error.retry === true;
}
```

## Integration Plan

1. Create a new `errors.ts` file in the `types` directory with the error class hierarchy and interfaces
2. Create a new `logging.ts` file in the `utils` directory with the logging implementation
3. Create a new `retry.ts` file in the `utils` directory with the retry mechanism
4. Modify the `pipeline.ts` file to integrate error handling into the pipeline execution
5. Update all step implementations to use the new error handling patterns
6. Add error handling to examples to demonstrate proper error handling patterns

## Testing Plan

1. Create unit tests for error classes and validation
2. Implement tests for retry mechanism
3. Add failure scenario tests for each step
4. Test pipeline execution with error handling and recovery

## Documentation Updates

1. Add error handling section to main README.md
2. Include examples of common error scenarios and how to handle them
3. Document available error codes and their meanings
4. Update JSDoc comments in all files to include error details