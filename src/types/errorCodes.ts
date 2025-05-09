/**
 * Comprehensive list of error codes used throughout the @plust/deep-restruct package
 */
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
  
  // Processing errors
  | 'processing_error'
  | 'timeout_error'
  | 'max_iterations_error'
  
  // Pipeline execution errors
  | 'pipeline_error'
  | 'step_execution_error'
  | 'parallel_execution_error'
  | 'step_timeout'

  // Generic errors
  | 'unknown_error'
  | 'not_implemented';

/**
 * Maps error codes to human-readable descriptions
 */
export const ERROR_CODE_DESCRIPTIONS: Record<ErrorCode, string> = {
  // Configuration errors
  'configuration_error': 'There was an error in the configuration of the research pipeline',
  'invalid_options': 'The options provided are invalid or contain incorrect values',
  'missing_required_option': 'A required option is missing from the configuration',
  'invalid_provider': 'The provider specified is invalid or not properly configured',
  
  // Validation errors
  'validation_error': 'Validation failed for the input or output data',
  'schema_validation_error': 'The data does not conform to the expected schema',
  'invalid_output_format': 'The output format of the data is invalid',
  
  // Network errors
  'network_error': 'A network operation failed',
  'request_timeout': 'The request timed out',
  'connection_error': 'Failed to establish a connection',
  
  // API errors
  'api_error': 'An API operation failed',
  'rate_limited': 'The request was rate limited by the API provider',
  'authentication_error': 'Authentication failed for the API request',
  'quota_exceeded': 'The API quota has been exceeded',
  
  // LLM errors
  'llm_error': 'An error occurred while processing the LLM request',
  'prompt_too_large': 'The prompt size exceeds the LLM model\'s maximum limit',
  'context_limit_exceeded': 'The context size exceeds the LLM model\'s maximum limit',
  'content_policy_violation': 'The content violates the LLM provider\'s content policy',
  
  // Search errors
  'search_error': 'An error occurred during the search operation',
  'no_results_found': 'No search results were found for the query',
  'invalid_search_query': 'The search query is invalid or unsupported',
  
  // Content extraction errors
  'extraction_error': 'Failed to extract content from the source',
  'selector_not_found': 'The specified selector was not found in the document',
  'invalid_content_format': 'The content format is invalid or unsupported',
  
  // Processing errors
  'processing_error': 'An error occurred during processing',
  'timeout_error': 'The operation timed out',
  'max_iterations_error': 'The maximum number of iterations was exceeded',
  
  // Pipeline execution errors
  'pipeline_error': 'An error occurred during pipeline execution',
  'step_execution_error': 'An error occurred during the execution of a pipeline step',
  'parallel_execution_error': 'An error occurred in parallel execution',
  'step_timeout': 'A pipeline step timed out',

  // Generic errors
  'unknown_error': 'An unknown error occurred',
  'not_implemented': 'This feature is not implemented yet'
};