/**
 * Tests for error handling classes and utilities
 */
import { 
  BaseResearchError,
  ConfigurationError,
  ValidationError,
  NetworkError,
  ApiError,
  LLMError,
  SearchError,
  ExtractionError,
  PipelineError,
  ProcessingError,
  TimeoutError,
  MaxIterationsError,
  isResearchError,
  isNetworkError,
  isApiError,
  isLLMError,
  isSearchError
} from '../../src/types/errors';
import { ErrorCode, ERROR_CODE_DESCRIPTIONS } from '../../src/types/errorCodes';

describe('Error handling system', () => {
  describe('BaseResearchError', () => {
    it('should create a basic error with required properties', () => {
      const error = new BaseResearchError({
        message: 'Test error message',
        code: 'unknown_error'
      });
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('unknown_error');
      expect(error.retry).toBe(false); // Default value
      expect(error.suggestions).toEqual([]); // Default value
      expect(error.details).toBeUndefined();
      expect(error.step).toBeUndefined();
    });
    
    it('should include optional properties when provided', () => {
      const error = new BaseResearchError({
        message: 'Test error with options',
        code: 'validation_error',
        step: 'TestStep',
        details: { testData: 'value' },
        retry: true,
        suggestions: ['Fix this', 'Try that']
      });
      
      expect(error.message).toBe('Test error with options');
      expect(error.code).toBe('validation_error');
      expect(error.step).toBe('TestStep');
      expect(error.details).toEqual({ testData: 'value' });
      expect(error.retry).toBe(true);
      expect(error.suggestions).toEqual(['Fix this', 'Try that']);
    });
    
    it('should format error message correctly', () => {
      const error = new BaseResearchError({
        message: 'Formatted error test',
        code: 'api_error',
        step: 'SearchStep',
        suggestions: ['Check API keys', 'Verify endpoint URL']
      });
      
      const formatted = error.getFormattedMessage();
      expect(formatted).toContain('[Step: SearchStep]');
      expect(formatted).toContain('[api_error]');
      expect(formatted).toContain('Formatted error test');
      expect(formatted).toContain('- Check API keys');
      expect(formatted).toContain('- Verify endpoint URL');
    });
  });
  
  describe('Specialized error classes', () => {
    it('should create ConfigurationError with correct code', () => {
      const error = new ConfigurationError({
        message: 'Missing required option'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('configuration_error');
      expect(error.name).toBe('ConfigurationError');
    });
    
    it('should create ValidationError with correct code', () => {
      const error = new ValidationError({
        message: 'Schema validation failed'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('validation_error');
      expect(error.name).toBe('ValidationError');
    });
    
    it('should create NetworkError with retry=true by default', () => {
      const error = new NetworkError({
        message: 'Connection failed'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('network_error');
      expect(error.name).toBe('NetworkError');
      expect(error.retry).toBe(true);
    });
    
    it('should create ApiError with statusCode in details', () => {
      const error = new ApiError({
        message: 'API rate limit exceeded',
        statusCode: 429
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('api_error');
      expect(error.name).toBe('ApiError');
      expect(error.details).toHaveProperty('statusCode', 429);
      expect(error.retry).toBe(false);
    });
    
    it('should create LLMError with retry=true by default', () => {
      const error = new LLMError({
        message: 'Model context limit exceeded'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('llm_error');
      expect(error.name).toBe('LLMError');
      expect(error.retry).toBe(true);
    });
    
    it('should create SearchError with retry=true by default', () => {
      const error = new SearchError({
        message: 'Search provider error'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('search_error');
      expect(error.name).toBe('SearchError');
      expect(error.retry).toBe(true);
    });
    
    it('should create ExtractionError with correct code', () => {
      const error = new ExtractionError({
        message: 'Content extraction failed'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('extraction_error');
      expect(error.name).toBe('ExtractionError');
    });
    
    it('should create PipelineError with correct code', () => {
      const error = new PipelineError({
        message: 'Pipeline execution failed'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('pipeline_error');
      expect(error.name).toBe('PipelineError');
    });
    
    it('should create ProcessingError with correct code', () => {
      const error = new ProcessingError({
        message: 'Data processing failed'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('processing_error');
      expect(error.name).toBe('ProcessingError');
    });
    
    it('should create TimeoutError with correct code', () => {
      const error = new TimeoutError({
        message: 'Operation timed out'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('timeout_error');
      expect(error.name).toBe('TimeoutError');
    });
    
    it('should create MaxIterationsError with correct code', () => {
      const error = new MaxIterationsError({
        message: 'Maximum iterations exceeded'
      });
      
      expect(error).toBeInstanceOf(BaseResearchError);
      expect(error.code).toBe('max_iterations_error');
      expect(error.name).toBe('MaxIterationsError');
    });
  });
  
  describe('Type guards', () => {
    it('should correctly identify ResearchError', () => {
      const researchError = new BaseResearchError({
        message: 'Test error',
        code: 'unknown_error'
      });
      
      const standardError = new Error('Standard error');
      
      expect(isResearchError(researchError)).toBe(true);
      expect(isResearchError(standardError)).toBe(false);
      expect(isResearchError(null)).toBe(false);
      expect(isResearchError(undefined)).toBe(false);
      expect(isResearchError('string error')).toBe(false);
    });
    
    it('should correctly identify NetworkError', () => {
      const networkError = new NetworkError({
        message: 'Connection error'
      });
      
      const apiError = new ApiError({
        message: 'API error'
      });
      
      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(apiError)).toBe(false);
    });
    
    it('should correctly identify ApiError', () => {
      const apiError = new ApiError({
        message: 'API error'
      });
      
      const validationError = new ValidationError({
        message: 'Validation error'
      });
      
      expect(isApiError(apiError)).toBe(true);
      expect(isApiError(validationError)).toBe(false);
    });
    
    it('should correctly identify LLMError', () => {
      const llmError = new LLMError({
        message: 'LLM error'
      });
      
      const networkError = new NetworkError({
        message: 'Network error'
      });
      
      expect(isLLMError(llmError)).toBe(true);
      expect(isLLMError(networkError)).toBe(false);
    });
    
    it('should correctly identify SearchError', () => {
      const searchError = new SearchError({
        message: 'Search error'
      });
      
      const configError = new ConfigurationError({
        message: 'Config error'
      });
      
      expect(isSearchError(searchError)).toBe(true);
      expect(isSearchError(configError)).toBe(false);
    });
  });
  
  describe('Error code descriptions', () => {
    it('should have descriptions for all error codes', () => {
      // Check a few error codes to ensure they have descriptions
      expect(ERROR_CODE_DESCRIPTIONS['network_error']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['validation_error']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['llm_error']).toBeDefined();
      
      // Verify that descriptions are non-empty strings
      Object.entries(ERROR_CODE_DESCRIPTIONS).forEach(([code, description]) => {
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });
});