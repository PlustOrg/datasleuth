/**
 * Tests for the retry utility functions
 */
import { executeWithRetry, withRetry } from '../../src/utils/retry';
import { NetworkError, ApiError } from '../../src/types/errors';

describe('Retry utilities', () => {
  // Use fake timers
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('executeWithRetry', () => {
    it('should execute function successfully without retries', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const resultPromise = executeWithRetry(fn);
      
      // No need to advance timers for the successful case
      const result = await resultPromise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('should retry when function throws a retryable error', async () => {
      // Function that fails twice then succeeds
      const fn = jest.fn()
        .mockRejectedValueOnce(new NetworkError({ message: 'Connection error', retry: true }))
        .mockRejectedValueOnce(new NetworkError({ message: 'Connection error', retry: true }))
        .mockResolvedValueOnce('success after retry');
      
      const promise = executeWithRetry(fn, { maxRetries: 3, retryDelay: 100 });
      
      // Run pending timers and flushes the micro task queue
      jest.runOnlyPendingTimers();
      await Promise.resolve(); // Gives time for the promise to settle

      // Run next timer
      jest.runOnlyPendingTimers();
      await Promise.resolve(); // Gives time for the promise to settle
      
      const result = await promise;
      
      expect(result).toBe('success after retry');
      expect(fn).toHaveBeenCalledTimes(3);
    });
    
    it('should respect maxRetries setting', async () => {
      // Function that always fails
      const fn = jest.fn().mockRejectedValue(
        new NetworkError({ message: 'Persistent network error', retry: true })
      );
      
      const promise = executeWithRetry(fn, { maxRetries: 2, retryDelay: 100 });
      
      // Run all pending timers
      jest.runAllTimers();
      
      await expect(promise).rejects.toThrow('Persistent network error');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
    
    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn().mockRejectedValue(
        new ApiError({ message: 'API validation error', retry: false })
      );
      
      await expect(executeWithRetry(fn)).rejects.toThrow('API validation error');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });
    
    it('should use custom retryable function when provided', async () => {
      // Function that fails with an error that's not inherently retryable
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Custom error'))
        .mockResolvedValueOnce('success after retry');
      
      // Custom function that considers all errors retryable
      const customRetryable = jest.fn().mockImplementation(() => true);
      
      const promise = executeWithRetry(fn, { 
        maxRetries: 1, 
        retryDelay: 100,
        retryableErrors: customRetryable
      });
      
      // Run all timers
      jest.runAllTimers();
      
      const result = await promise;
      
      expect(result).toBe('success after retry');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(customRetryable).toHaveBeenCalledTimes(1);
    });
    
    it('should call onRetry when provided', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new NetworkError({ message: 'Network error', retry: true }))
        .mockResolvedValueOnce('success');
      
      const onRetry = jest.fn();
      
      const promise = executeWithRetry(fn, { 
        maxRetries: 1, 
        retryDelay: 100,
        onRetry
      });
      
      // Run all timers
      jest.runAllTimers();
      
      await promise;
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1, // attempt number
        expect.any(NetworkError), // error
        100 // delay
      );
    });
    
    it('should use backoff factor for increasing delays', async () => {
      // Function that fails multiple times
      const fn = jest.fn()
        .mockRejectedValueOnce(new NetworkError({ message: 'First failure', retry: true }))
        .mockRejectedValueOnce(new NetworkError({ message: 'Second failure', retry: true }))
        .mockResolvedValueOnce('success');
      
      const onRetry = jest.fn();
      
      const promise = executeWithRetry(fn, { 
        maxRetries: 2, 
        retryDelay: 100,
        backoffFactor: 3, // Triple the delay each time
        onRetry
      });
      
      // Run all timers
      jest.runAllTimers();
      
      await promise;
      
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(NetworkError), 100);
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(NetworkError), 300);
    });
  });
  
  describe('withRetry decorator', () => {
    it('should add retry behavior to a function', async () => {
      // Function that fails once then succeeds
      const originalFn = jest.fn()
        .mockRejectedValueOnce(new NetworkError({ message: 'Temporary error', retry: true }))
        .mockResolvedValueOnce('decorated success');
      
      // Decorate the function with retry behavior
      const decoratedFn = withRetry({ maxRetries: 1, retryDelay: 100 })(originalFn);
      
      const promise = decoratedFn('arg1', 'arg2');
      
      // Run all timers
      jest.runAllTimers();
      
      const result = await promise;
      
      expect(result).toBe('decorated success');
      expect(originalFn).toHaveBeenCalledTimes(2);
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
    
    it('should preserve function arguments when retrying', async () => {
      // Function with multiple arguments that fails then succeeds
      const complexFn = jest.fn()
        .mockImplementation(async (arg1, arg2, options) => {
          if (complexFn.mock.calls.length === 1) {
            throw new NetworkError({ message: 'First call fails', retry: true });
          }
          return `${arg1}-${arg2}-${options.key}`;
        });
      
      const retryableComplexFn = withRetry({ maxRetries: 1, retryDelay: 50 })(complexFn);
      
      const promise = retryableComplexFn('value1', 'value2', { key: 'test' });
      
      // Run all timers
      jest.runAllTimers();
      
      const result = await promise;
      
      expect(result).toBe('value1-value2-test');
      expect(complexFn).toHaveBeenCalledTimes(2);
      expect(complexFn).toHaveBeenCalledWith('value1', 'value2', { key: 'test' });
    });
  });
});