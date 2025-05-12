# Troubleshooting Guide for @plust/datasleuth

This guide helps you identify and resolve common issues that may occur when using @plust/datasleuth.

## Table of Contents

- [Common Error Types](#common-error-types)
- [LLM Integration Issues](#llm-integration-issues)
- [Search Provider Configuration](#search-provider-configuration)
- [Schema Validation Errors](#schema-validation-errors)
- [Performance Issues](#performance-issues)
- [Memory Usage Optimization](#memory-usage-optimization)
- [Debugging Strategies](#debugging-strategies)

## Common Error Types

@plust/datasleuth provides detailed error types for different failure scenarios. Here's how to handle them:

### ConfigurationError

**Problem:** Missing or invalid configuration parameters.

**Solution:**
- Check that all required parameters are provided
- Verify that configuration values match expected types and formats
- Look at the error details and suggestions for specific guidance

```typescript
try {
  const results = await research({ /*...*/ });
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(`Configuration error: ${error.message}`);
    console.error(`Details: ${JSON.stringify(error.details)}`);
    console.error(`Fix suggestions: ${error.suggestions.join('\n')}`);
  }
}
```

### ValidationError

**Problem:** Output doesn't match the provided schema.

**Solution:**
- Examine the validation error to see which fields failed
- Adjust your schema to match the actual output structure
- Use `z.optional()` for fields that might not always be present
- Add transformations to ensure output matches your requirements

### LLMError

**Problem:** Error when communicating with language model.

**Solution:**
- Verify API keys and permissions are correct
- Check network connectivity
- Examine rate limits or quota restrictions
- Consider using a different model or provider
- Implement retry mechanisms with backoff

### SearchError

**Problem:** Error executing web searches.

**Solution:**
- Verify search provider API keys and configuration
- Check usage limits and quotas
- Try different search queries
- Implement retry mechanisms with appropriate backoff

### ContentExtractionError

**Problem:** Error extracting content from web pages.

**Solution:**
- Check that the URLs are accessible
- Adjust selectors for content extraction
- Handle pagination or dynamically loaded content
- Implement fallback selectors for different page structures

### TimeoutError

**Problem:** Operation exceeded the configured timeout.

**Solution:**
- Increase timeout limits for complex operations
- Break down research into smaller subtasks
- Optimize performance bottlenecks
- Use caching for expensive operations

## LLM Integration Issues

### No Language Model Provided

**Problem:** Error about missing LLM.

**Solution:**
- Provide a default LLM when initializing research:
  ```typescript
  import { openai } from '@ai-sdk/openai';
  
  research({
    query: "Your query",
    defaultLLM: openai('gpt-4o'),
    outputSchema: schema
  });
  ```

- Or specify an LLM for each step that requires one:
  ```typescript
  steps: [
    plan({ llm: openai('gpt-4o') }),
    // other steps...
  ]
  ```

### Unsupported Model

**Problem:** Error about unsupported model.

**Solution:**
- Verify that you're using a supported model identifier
- Update to the latest version of the AI SDK
- Check model availability in your region
- Ensure you're properly authenticated with the LLM provider

### Token Limits Exceeded

**Problem:** Error about token limits or content being too long.

**Solution:**
- Implement content chunking for large documents
- Add `maxContentSize` option to steps that process large content
- Use efficient prompt templates
- Consider using models with larger context windows

## Search Provider Configuration

### No Search Results

**Problem:** Search steps return no results.

**Solution:**
- Verify search provider API keys and configuration
- Examine search query complexity and rephrase if needed
- Check for rate limits or quotas
- Try different search providers
- Add logging to see the actual queries being sent

### Authentication Errors

**Problem:** Errors relating to API authentication.

**Solution:**
- Verify API keys are correct and not expired
- Ensure keys have required permissions
- Check that the API endpoint URLs are correct
- Store API keys securely in environment variables

### Usage Limits

**Problem:** API usage limit errors.

**Solution:**
- Implement rate limiting in your application
- Add exponential backoff for retries
- Consider upgrading your API plan
- Distribute requests across multiple API keys
- Cache results for repeated searches

## Schema Validation Errors

### Missing Required Fields

**Problem:** Validation fails due to missing fields.

**Solution:**
- Examine the validation error to see which fields are missing
- Ensure the research pipeline is generating all required fields
- Make fields optional if they might not always be present:
  ```typescript
  const schema = z.object({
    summary: z.string(),
    findings: z.array(z.string()).optional(), // Make optional
    // or provide default value:
    sources: z.array(z.string().url()).default([])
  });
  ```

### Type Mismatch

**Problem:** Type validation failures.

**Solution:**
- Check the expected types in your schema
- Add type transformations for common cases:
  ```typescript
  // Transform string numbers to actual numbers
  const schema = z.object({
    value: z.preprocess(
      (val) => typeof val === 'string' ? Number(val) : val,
      z.number()
    )
  });
  ```
- Use `z.union()` for fields that might have multiple types:
  ```typescript
  const schema = z.object({
    date: z.union([z.string(), z.date()])
  });
  ```

### Complex Validation Issues

**Problem:** Issues with nested objects or arrays.

**Solution:**
- Break down complex schemas into smaller parts
- Use `z.array()`, `z.record()`, and `z.object()` appropriately
- Add custom validation with `.refine()`:
  ```typescript
  const schema = z.object({
    items: z.array(z.string()).refine(
      (items) => items.length > 0,
      { message: "Items array cannot be empty" }
    )
  });
  ```

## Performance Issues

### Slow Research Execution

**Problem:** Research pipeline takes too long to complete.

**Solution:**
- Break complex research into multiple focused queries
- Use parallel processing for independent research tracks
- Add timeouts to each step to prevent long-running operations
- Optimize steps that process large amounts of data

### Memory Usage

**Problem:** High memory usage during research.

**Solution:**
- Limit the amount of content processed at once
- Use streaming for large content processing
- Implement cleanup for intermediate data
- Release references to large objects when no longer needed

### LLM Response Time

**Problem:** LLM operations are slow.

**Solution:**
- Use smaller, faster models for tasks that don't require advanced capabilities
- Optimize prompts to be concise and efficient
- Implement request batching where appropriate
- Add caching for repeated LLM queries
- Use parallel LLM calls when appropriate

## Memory Usage Optimization

### Large Content Processing

**Problem:** Memory issues when processing large documents.

**Solution:**
- Process content in chunks:
  ```typescript
  // Process content in 10KB chunks
  const chunkSize = 10 * 1024;
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.substring(i, i + chunkSize);
    // Process chunk...
  }
  ```
- Use streams for content processing
- Implement pagination for web content extraction
- Set maximum content size limits:
  ```typescript
  extractContent({ maxContentLength: 50000 })
  ```

### Efficient Data Structures

**Problem:** Inefficient data handling in complex research.

**Solution:**
- Avoid deep object cloning where possible
- Use Map and Set for efficient lookups and deduplications
- Release references to large objects after use
- Store binary data efficiently (use Buffer instead of strings)

## Debugging Strategies

### Enable Verbose Logging

**Problem:** Need more information about what's happening.

**Solution:**
- Configure logging level:
  ```typescript
  research({
    query: "Your query",
    outputSchema: schema,
    config: {
      logLevel: 'debug' // 'error', 'warn', 'info', 'debug', 'trace'
    }
  });
  ```

### Inspect Pipeline State

**Problem:** Need to understand intermediate state.

**Solution:**
- Add custom evaluation steps to inspect state:
  ```typescript
  steps: [
    // other steps...
    evaluate({
      criteriaFn: (state) => {
        console.log('Current state:', JSON.stringify(state.data, null, 2));
        return true; // Always continue
      }
    })
  ]
  ```

### Isolate Issues

**Problem:** Complex pipeline with unknown failure point.

**Solution:**
- Run individual steps in isolation:
  ```typescript
  // Test just the search step
  const result = await research({
    query: "Your query",
    outputSchema: schema,
    steps: [searchWeb({ provider: googleSearch })]
  });
  ```
- Add error handling to continue on failure:
  ```typescript
  research({
    query: "Your query",
    outputSchema: schema,
    config: {
      errorHandling: 'continue',
      continueOnError: true
    }
  });
  ```

If you encounter an issue not covered by this guide, please check the [GitHub issues](https://github.com/Jacques2Marais/datasleuth/issues) or submit a new one with detailed information about the problem.
