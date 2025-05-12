/**
 * Transform step for the research pipeline
 * Ensures output matches the expected schema structure
 */
import { createStep } from '../utils/steps.js';
import { ResearchState, StepOptions } from '../types/pipeline.js';
import { createStepLogger } from '../utils/logging.js';
import { ValidationError, LLMError, ConfigurationError } from '../types/errors.js';
import { z } from 'zod';
import { generateObject, generateText, LanguageModel } from 'ai';
import { executeWithRetry } from '../utils/retry.js';

/**
 * Options for the transform step
 */
export interface TransformOptions extends StepOptions {
  /** Custom transformation function */
  transformFn?: (state: ResearchState) => Record<string, any>;
  /** Whether to allow missing fields with defaults */
  allowMissingWithDefaults?: boolean;
  /** Override output validation (use with caution) */
  skipValidation?: boolean;
  /** Use LLM to intelligently format output according to schema */
  useLLM?: boolean;
  /** Custom LLM to use for transformation (falls back to state.defaultLLM) */
  llm?: LanguageModel;
  /** Temperature for LLM generation (0.0 to 1.0) */
  temperature?: number;
  /** Custom system prompt for the LLM */
  systemPrompt?: string;
  /** Retry configuration for LLM calls */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * LLM-based default system prompt for transformation
 */
const DEFAULT_TRANSFORM_PROMPT = `
You are a research data transformer responsible for structuring research results.
Your task is to take research data gathered from various sources and organize it
according to a specific schema structure.

The data will include some or all of the following:
- Research plans
- Web search results
- Extracted content
- Fact-checked statements
- Analysis results
- Summary information

Analyze this data and format it according to the requested output schema.
Focus on accuracy, relevance, and maintaining the integrity of the information.
Ensure all required fields in the schema are populated with appropriate content.

IMPORTANT: Pay careful attention to nested objects and arrays in the schema.
For each field in the schema:
1. Ensure it has the correct type (string, number, array, object)
2. For arrays of objects, ensure each object has all required properties
3. For nested objects, ensure all required properties are present
4. For 'url' fields, provide valid URLs starting with http:// or https://
5. If you're unsure about specific content, provide reasonable placeholder values
   that follow the schema structure

Be thorough and aim for completeness rather than leaving fields undefined.
`;

/**
 * Executes the transform step
 */
async function executeTransformStep(
  state: ResearchState,
  options: TransformOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Transform');

  const {
    transformFn,
    allowMissingWithDefaults = true,
    skipValidation = false,
    useLLM = true,
    llm,
    temperature = 0.2,
    systemPrompt = DEFAULT_TRANSFORM_PROMPT,
    retry = { maxRetries: 2, baseDelay: 1000 },
  } = options;

  stepLogger.info('Starting output transformation');

  try {
    // Extract the schema from state
    const { outputSchema } = state;

    // Get the current results data (usually from the last result)
    const currentResult = state.results.length > 0 ? state.results[state.results.length - 1] : {};

    let transformedResult;

    // Apply custom transformation if provided
    if (transformFn) {
      stepLogger.debug('Applying custom transformation function');
      transformedResult = transformFn(state);
    }
    // Use LLM-based transformation if enabled and we have an LLM
    else if (useLLM && (llm || state.defaultLLM)) {
      stepLogger.debug('Using LLM for intelligent transformation');
      const modelToUse = llm || state.defaultLLM;

      if (!modelToUse) {
        throw new ConfigurationError({
          message: 'No language model provided for LLM-based transformation',
          step: 'Transform',
          details: { options },
          suggestions: [
            "Provide an LLM in the transform options using the 'llm' parameter",
            'Set a defaultLLM when initializing the research function',
            'Set useLLM: false to use the default transformation logic without an LLM',
          ],
        });
      }

      // Apply retry with guaranteed values instead of potentially undefined ones
      const safeRetry = {
        maxRetries: retry?.maxRetries ?? 2,
        baseDelay: retry?.baseDelay ?? 1000,
      };

      transformedResult = await transformWithLLM(
        state,
        outputSchema,
        modelToUse,
        temperature,
        systemPrompt,
        safeRetry,
        stepLogger
      );
    }
    // Default transformation logic
    else {
      stepLogger.debug('Applying default transformation logic');
      transformedResult = buildTransformedOutput(state, outputSchema);
    }

    // Validate against the schema (unless skipped)
    if (!skipValidation) {
      try {
        const validatedResult = outputSchema.parse(transformedResult);
        stepLogger.info('Output validation successful');
        transformedResult = validatedResult;
      } catch (error) {
        if (error instanceof z.ZodError) {
          stepLogger.warn('Schema validation failed, attempting to fix missing fields');

          if (allowMissingWithDefaults) {
            // Try to fix missing fields with defaults
            transformedResult = fixMissingFields(transformedResult, error, state);

            // Validate again after fixes
            outputSchema.parse(transformedResult);
            stepLogger.info('Output validation successful after applying fixes');
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    // Update the state with the transformed result
    const newState = {
      ...state,
      results: [...state.results.slice(0, -1), transformedResult],
      metadata: {
        ...state.metadata,
        transformApplied: true,
        transformTimestamp: new Date().toISOString(),
        transformMethod: transformFn ? 'custom' : useLLM ? 'llm' : 'default',
      },
    };

    stepLogger.info('Output transformation complete');
    return newState;
  } catch (error) {
    stepLogger.error(
      `Error during output transformation: ${error instanceof Error ? error.message : String(error)}`
    );

    if (error instanceof z.ZodError) {
      throw new ValidationError({
        message: 'Output schema validation failed during transformation',
        step: 'Transform',
        details: {
          zodErrors: error.errors,
          currentOutput: state.results[state.results.length - 1] || {},
        },
        suggestions: [
          'Check that your output schema matches the structure of your results',
          'Add a custom transformFn to format the output correctly',
          'Use allowMissingWithDefaults to auto-fill missing fields',
        ],
      });
    }

    if (error instanceof ConfigurationError) {
      // Pass through configuration errors
      throw error;
    }

    if (error instanceof LLMError) {
      // Pass through LLM errors
      throw error;
    }

    // Wrap other errors
    throw new ValidationError({
      message: `Error during transformation: ${error instanceof Error ? error.message : String(error)}`,
      step: 'Transform',
      details: { error },
      suggestions: [
        'Check your transformation configuration',
        'If using LLM transformation, ensure the LLM is configured correctly',
        'Provide a custom transformFn to have more control over the transformation process',
      ],
    });
  }
}

/**
 * Transform research data using an LLM
 */
async function transformWithLLM(
  state: ResearchState,
  schema: z.ZodType,
  llm: LanguageModel,
  temperature: number,
  systemPrompt: string,
  retry: { maxRetries: number; baseDelay: number },
  stepLogger: ReturnType<typeof createStepLogger>
): Promise<Record<string, any>> {
  stepLogger.info('Starting LLM-based transformation');

  try {
    // Prepare research data for the LLM
    const researchData = prepareResearchDataForLLM(state);

    // Extract schema info for the prompt
    const schemaInfo = extractSchemaInfo(schema);

    // Create the full context
    const prompt = `
Query: "${state.query}"

## Research Data
${researchData}

## Output Schema Required
${schemaInfo}

## Instructions
Format the research data according to the schema above. Ensure all required fields are included.
Extract the key information from the research data and structure it to match the schema requirements.
Focus on accuracy, relevance, and completeness. Use your best judgment to format and structure the data.
`;

    stepLogger.debug('Generated transformation prompt');

    // Use executeWithRetry for resilience
    return await executeWithRetry(
      async () => {
        try {
          stepLogger.debug('Calling LLM with generateObject');
          // Use generativeObject to generate schema-compliant output
          const { object } = await generateObject({
            model: llm,
            schema: schema,
            system: systemPrompt,
            prompt,
            temperature,
          });

          stepLogger.info('Successfully generated structured output with LLM');
          return object;
        } catch (error) {
          // If generateObject fails, try with generateText and parse JSON manually
          stepLogger.warn(
            `generateObject failed: ${error instanceof Error ? error.message : String(error)}. Falling back to generateText.`
          );

          // Modify prompt to request JSON output
          const textPrompt = `${prompt}\n\nReturn your response as a valid JSON object that follows the schema requirements.`;

          const { text } = await generateText({
            model: llm,
            system: systemPrompt,
            prompt: textPrompt,
            temperature,
          });

          // Try to extract and parse JSON from the response
          const jsonMatch =
            text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/{[\s\S]*}/);
          if (jsonMatch) {
            const jsonString = jsonMatch[0].replace(/```(?:json)?\s*|\s*```/g, '');
            try {
              const parsed = JSON.parse(jsonString);
              stepLogger.info('Successfully parsed JSON from text response');
              return parsed;
            } catch (parseError: unknown) {
              // Handle type-safe error message
              const errorMessage =
                parseError instanceof Error ? parseError.message : 'Unknown JSON parse error';

              throw new Error(`Failed to parse JSON from LLM response: ${errorMessage}`);
            }
          } else {
            throw new Error('LLM response did not contain valid JSON');
          }
        }
      },
      {
        maxRetries: retry.maxRetries,
        retryDelay: retry.baseDelay,
        backoffFactor: 2,
        onRetry: (attempt: number, error: unknown, delay: number) => {
          stepLogger.warn(
            `Retry attempt ${attempt} for LLM transformation: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying in ${delay}ms...`
          );
        },
      }
    );
  } catch (error) {
    stepLogger.error(
      `Error in LLM transformation: ${error instanceof Error ? error.message : String(error)}`
    );

    // Throw appropriate error type
    if (error instanceof Error && error.message.includes('rate limit')) {
      throw new LLMError({
        message: `LLM rate limit exceeded during transformation: ${error.message}`,
        step: 'Transform',
        details: { error },
        retry: true,
        suggestions: [
          'Wait and try again later',
          'Consider using a different LLM provider',
          'Set useLLM: false to use the default transformation logic without an LLM',
        ],
      });
    }

    throw new LLMError({
      message: `Failed to transform data with LLM: ${error instanceof Error ? error.message : String(error)}`,
      step: 'Transform',
      details: { error },
      retry: true,
      suggestions: [
        'Check your LLM configuration',
        'Verify that the schema is compatible with the LLM',
        'Set useLLM: false to use the default transformation logic',
      ],
    });
  }
}

/**
 * Prepares research data for LLM consumption
 */
function prepareResearchDataForLLM(state: ResearchState): string {
  const parts: string[] = [];

  // Add research plan
  if (state.data.researchPlan) {
    parts.push('### Research Plan');
    const plan = state.data.researchPlan;

    if (typeof plan === 'string') {
      parts.push(plan);
    } else {
      // Handle different research plan structures
      if (plan.objectives) {
        parts.push('Objectives:');
        if (Array.isArray(plan.objectives)) {
          plan.objectives.forEach((obj: string, i: number) => parts.push(`${i + 1}. ${obj}`));
        } else {
          parts.push(String(plan.objectives));
        }
      }

      if (plan.searchQueries) {
        parts.push('\nSearch Queries:');
        if (Array.isArray(plan.searchQueries)) {
          plan.searchQueries.forEach((q: string, i: number) => parts.push(`${i + 1}. ${q}`));
        } else {
          parts.push(String(plan.searchQueries));
        }
      }
    }
  }

  // Add search results
  if (state.data.searchResults && state.data.searchResults.length > 0) {
    parts.push('\n### Search Results');
    state.data.searchResults.slice(0, 5).forEach((result, i: number) => {
      parts.push(`${i + 1}. ${result.title || 'Untitled'}`);
      parts.push(`   URL: ${result.url}`);
      if (result.snippet) {
        parts.push(`   Snippet: ${result.snippet}`);
      }
    });

    if (state.data.searchResults.length > 5) {
      parts.push(`... and ${state.data.searchResults.length - 5} more results`);
    }
  }

  // Add extracted content (summarized)
  if (state.data.extractedContent && state.data.extractedContent.length > 0) {
    parts.push('\n### Extracted Content');
    state.data.extractedContent.forEach((content, i: number) => {
      parts.push(`${i + 1}. From: ${content.title || content.url}`);
      // Include a preview of content (first 200 chars)
      if (content.content) {
        const preview =
          content.content.length > 200
            ? content.content.substring(0, 200) + '...'
            : content.content;
        parts.push(`   Preview: ${preview}`);
      }
    });
  }

  // Add fact checks
  if (state.data.factChecks && state.data.factChecks.length > 0) {
    parts.push('\n### Fact Checks');
    state.data.factChecks.forEach((check, i: number) => {
      parts.push(`${i + 1}. "${check.statement}"`);
      parts.push(`   Valid: ${check.isValid}, Confidence: ${check.confidence.toFixed(2)}`);
      if (check.corrections) {
        parts.push(`   Corrections: ${check.corrections}`);
      }
    });
  }

  // Add analysis results
  if (state.data.analysis) {
    parts.push('\n### Analysis Results');
    Object.entries(state.data.analysis).forEach(([key, analysis]) => {
      parts.push(`Analysis focus: ${key}`);
      if (analysis.insights && analysis.insights.length > 0) {
        parts.push('Insights:');
        analysis.insights.forEach((insight: string, i: number) =>
          parts.push(`${i + 1}. ${insight}`)
        );
      }
    });
  }

  // Add summary
  if (state.data.summary) {
    parts.push('\n### Summary');
    parts.push(state.data.summary);
  }

  // Add structured summary if available
  if (state.data.structuredSummary) {
    parts.push('\n### Structured Summary');
    const structuredSummary = state.data.structuredSummary;

    if (structuredSummary.keyPoints && structuredSummary.keyPoints.length > 0) {
      parts.push('Key Points:');
      structuredSummary.keyPoints.forEach((point: string, i: number) =>
        parts.push(`${i + 1}. ${point}`)
      );
    }

    if (structuredSummary.sources && structuredSummary.sources.length > 0) {
      parts.push('\nSources:');
      structuredSummary.sources.forEach((source: string, i: number) =>
        parts.push(`${i + 1}. ${source}`)
      );
    }
  }

  return parts.join('\n');
}

/**
 * Extracts schema information for the LLM prompt
 */
function extractSchemaInfo(schema: z.ZodType): string {
  // For recursive schema extraction
  function extractRecursive(zodType: z.ZodTypeAny, indent: string = ''): string[] {
    const descriptions: string[] = [];

    // Handle different Zod types
    if (zodType instanceof z.ZodObject) {
      const shape = zodType.shape as Record<string, z.ZodTypeAny>;

      for (const [key, subType] of Object.entries(shape)) {
        const isRequired = !subType.isOptional();
        let typeDesc: string;
        let description = '';

        // Extract description if available
        if ('description' in subType._def && subType._def.description) {
          description = subType._def.description;
        }

        // Handle nested objects
        if (subType instanceof z.ZodObject) {
          descriptions.push(
            `${indent}${key}: object${isRequired ? ' (required)' : ' (optional)'}${description ? ` - ${description}` : ''}`
          );
          const nestedDescriptions = extractRecursive(subType, `${indent}  `);
          descriptions.push(...nestedDescriptions);
        }
        // Handle arrays
        else if (subType instanceof z.ZodArray) {
          const innerType = subType._def.type;

          if (innerType instanceof z.ZodObject) {
            descriptions.push(
              `${indent}${key}: array of objects${isRequired ? ' (required)' : ' (optional)'}${description ? ` - ${description}` : ''}`
            );
            descriptions.push(`${indent}  Each item should have:`);
            const nestedDescriptions = extractRecursive(innerType, `${indent}    `);
            descriptions.push(...nestedDescriptions);
          } else if (innerType instanceof z.ZodString) {
            const format = innerType._def.checks?.find((check) => check.kind === 'url')
              ? ' (URLs)'
              : '';
            descriptions.push(
              `${indent}${key}: array of strings${format}${isRequired ? ' (required)' : ' (optional)'}${description ? ` - ${description}` : ''}`
            );
          } else if (innerType instanceof z.ZodNumber) {
            descriptions.push(
              `${indent}${key}: array of numbers${isRequired ? ' (required)' : ' (optional)'}${description ? ` - ${description}` : ''}`
            );
          } else {
            descriptions.push(
              `${indent}${key}: array${isRequired ? ' (required)' : ' (optional)'}${description ? ` - ${description}` : ''}`
            );
          }
        }
        // Handle primitives
        else if (subType instanceof z.ZodString) {
          const format = subType._def.checks?.find((check) => check.kind === 'url') ? ' (URL)' : '';
          descriptions.push(
            `${indent}${key}: string${format}${isRequired ? ' (required)' : ' (optional)'}${description ? ` - ${description}` : ''}`
          );
        } else if (subType instanceof z.ZodNumber) {
          descriptions.push(
            `${indent}${key}: number${isRequired ? ' (required)' : ' (optional)'}${description ? ` - ${description}` : ''}`
          );
        } else if (subType instanceof z.ZodBoolean) {
          descriptions.push(
            `${indent}${key}: boolean${isRequired ? ' (required)' : ' (optional)'}${description ? ` - ${description}` : ''}`
          );
        } else {
          descriptions.push(
            `${indent}${key}: unknown type${isRequired ? ' (required)' : ' (optional)'}${description ? ` - ${description}` : ''}`
          );
        }
      }
    }

    return descriptions;
  }

  // Start extraction from the root schema
  if (schema instanceof z.ZodObject) {
    return extractRecursive(schema).join('\n');
  }

  // Fallback for non-object schemas
  return 'Schema details not available. Please organize data in a structured format.';
}

/**
 * Build transformed output based on the schema and available state data
 */
function buildTransformedOutput(state: ResearchState, schema: z.ZodType): Record<string, any> {
  const result = state.results.length > 0 ? state.results[state.results.length - 1] : {};

  const output: Record<string, any> = { ...result };

  // Extract the schema shape
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;

    // Add common schema fields from state if they're missing in the current result

    // Summary field
    if (shape.summary && !output.summary && state.data.summary) {
      output.summary = state.data.summary;
    }

    // Key findings field
    if (shape.keyFindings && !output.keyFindings) {
      if (state.data.structuredSummary?.keyPoints) {
        output.keyFindings = state.data.structuredSummary.keyPoints;
      } else if (state.data.factChecks) {
        // Create from valid fact check statements
        output.keyFindings = state.data.factChecks
          .filter((check) => check.isValid)
          .map((check) => check.statement);
      }
    }

    // Sources field
    if (shape.sources && !output.sources) {
      // Try to get from different possible locations
      if (state.data.structuredSummary?.sources) {
        output.sources = state.data.structuredSummary.sources;
      } else if (state.data.extractedContent) {
        output.sources = state.data.extractedContent.map((content) => content.url).filter(Boolean);
      } else if (state.data.searchResults) {
        output.sources = state.data.searchResults.map((result) => result.url).filter(Boolean);
      }
    }
  }

  return output;
}

/**
 * Attempt to fix missing fields with sensible defaults
 * Handles nested objects and arrays recursively
 */
function fixMissingFields(
  result: Record<string, any>,
  error: z.ZodError,
  state: ResearchState
): Record<string, any> {
  const fixed = JSON.parse(JSON.stringify(result)); // Deep clone to avoid mutations
  const fixedPaths = new Set<string>(); // Track fixed paths to avoid redundant fixes

  // Group errors by path for efficient processing
  const errorsByPath = error.errors.reduce(
    (acc, issue) => {
      const path = issue.path.join('.');
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(issue);
      return acc;
    },
    {} as Record<string, typeof error.errors>
  );

  // Process each error path
  for (const [pathStr, issues] of Object.entries(errorsByPath)) {
    if (fixedPaths.has(pathStr)) continue;

    const path = pathStr.split('.');
    const issue = issues[0]; // Take the first issue for this path

    // Create any missing parent objects in the path
    ensurePathExists(fixed, path);

    // Handle different error codes
    if (issue.code === 'invalid_type') {
      const { expected } = issue as { expected: string };

      if (expected === 'string') {
        setValueAtPath(fixed, path, getDefaultString(path));
      } else if (expected === 'number') {
        setValueAtPath(fixed, path, 0);
      } else if (expected === 'boolean') {
        setValueAtPath(fixed, path, false);
      } else if (expected === 'array') {
        // Create empty array and then populate based on schema expectations
        const arrayValue = createDefaultArray(path, state);
        setValueAtPath(fixed, path, arrayValue);
      } else if (expected === 'object') {
        // Create empty object and then fix nested fields
        setValueAtPath(fixed, path, {});
      }
    }

    fixedPaths.add(pathStr);
  }

  // Second pass to handle nested errors in arrays and objects after parent structures exist
  for (const issue of error.errors) {
    const path = issue.path;

    // Handle array items specially - they often have numeric indices in the path
    if (path.length >= 2 && typeof path[path.length - 2] === 'number') {
      const parentPath = path.slice(0, path.length - 1);
      const parentPathStr = parentPath.join('.');

      if (!fixedPaths.has(parentPathStr)) {
        // Try to fix the array item by creating appropriate objects
        const arrayItemValue = getValueAtPath(fixed, parentPath);
        if (arrayItemValue === undefined) {
          setValueAtPath(fixed, parentPath, {});
          fixedPaths.add(parentPathStr);
        }
      }
    }
  }

  return fixed;
}

/**
 * Ensures a path exists in an object by creating any missing objects along the way
 */
function ensurePathExists(obj: any, path: Array<string | number>): void {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];

    // Handle array indices
    if (typeof key === 'number' || /^\d+$/.test(key as string)) {
      const index = typeof key === 'number' ? key : parseInt(key as string);
      if (!Array.isArray(current[path[i - 1]])) {
        current[path[i - 1]] = [];
      }
      if (current[path[i - 1]][index] === undefined) {
        current[path[i - 1]][index] = {};
      }
      current = current[path[i - 1]][index];
    }
    // Handle regular object properties
    else {
      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key];
    }
  }
}

/**
 * Sets a value at a specified path in an object
 */
function setValueAtPath(obj: any, path: Array<string | number>, value: any): void {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];

    // Handle array indices
    if (typeof key === 'number' || /^\d+$/.test(key as string)) {
      const index = typeof key === 'number' ? key : parseInt(key as string);
      if (!Array.isArray(current[path[i - 1]])) {
        current[path[i - 1]] = [];
      }
      if (current[path[i - 1]][index] === undefined) {
        current[path[i - 1]][index] = {};
      }
      current = current[path[i - 1]][index];
    }
    // Handle regular object properties
    else {
      if (current[key] === undefined) {
        // Create array if next part is a number, otherwise object
        const nextKey = path[i + 1];
        current[key] = typeof nextKey === 'number' || /^\d+$/.test(nextKey as string) ? [] : {};
      }
      current = current[key];
    }
  }

  // Set the value at the final key
  const lastKey = path[path.length - 1];
  current[lastKey] = value;
}

/**
 * Gets a value at a specified path in an object
 */
function getValueAtPath(obj: any, path: Array<string | number>): any {
  let current = obj;

  for (const key of path) {
    if (current === undefined || current === null) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

/**
 * Generate a default string based on the field name/path
 */
function getDefaultString(path: Array<string | number>): string {
  const lastKey = path[path.length - 1];

  // Special handling for common field names
  if (lastKey === 'title' || lastKey === 'name') {
    return 'Untitled';
  } else if (lastKey === 'summary' || lastKey === 'description') {
    return 'No information available';
  } else if (lastKey === 'url' || lastKey === 'link') {
    return 'https://example.com/placeholder';
  } else if (lastKey === 'approach') {
    return 'General approach';
  } else if (lastKey === 'relevance') {
    return 'General reference';
  } else if (lastKey === 'futurePerspectives') {
    return 'Future possibilities require further research';
  }

  // Default value
  return 'No data available';
}

/**
 * Create a default array with appropriate items based on context
 */
function createDefaultArray(path: Array<string | number>, state: ResearchState): any[] {
  const lastKey = path[path.length - 1];

  // Handle specific array field names with appropriate defaults
  if (lastKey === 'keyFindings' || lastKey === 'findings') {
    return ['Key finding information not available'];
  } else if (lastKey === 'challenges') {
    return ['Challenge information not available'];
  } else if (lastKey === 'innovations') {
    return ['Innovation information not available'];
  } else if (lastKey === 'strengths') {
    return ['Strength information not available'];
  } else if (lastKey === 'weaknesses') {
    return ['Weakness information not available'];
  } else if (lastKey === 'sources') {
    // Try to extract sources from state
    if (state.data.extractedContent && state.data.extractedContent.length > 0) {
      return state.data.extractedContent.slice(0, 3).map((content) => ({
        url: content.url,
        title: content.title || 'Unknown source',
        relevance: 'General reference',
      }));
    } else if (state.data.searchResults && state.data.searchResults.length > 0) {
      return state.data.searchResults.slice(0, 3).map((result) => ({
        url: result.url,
        title: result.title || 'Unknown source',
        relevance: 'General reference',
      }));
    }

    // Fallback if no sources available
    return [
      {
        url: 'https://example.com/source1',
        title: 'Example Source 1',
        relevance: 'General reference',
      },
      {
        url: 'https://example.com/source2',
        title: 'Example Source 2',
        relevance: 'General reference',
      },
    ];
  } else if (lastKey === 'comparativeAnalysis') {
    return [
      {
        approach: 'Approach 1',
        strengths: ['Strength information not available'],
        weaknesses: ['Weakness information not available'],
      },
      {
        approach: 'Approach 2',
        strengths: ['Strength information not available'],
        weaknesses: ['Weakness information not available'],
      },
      {
        approach: 'Approach 3',
        strengths: ['Strength information not available'],
        weaknesses: ['Weakness information not available'],
      },
    ];
  }

  // Default empty array for unknown fields
  return ['No information available'];
}

/**
 * Creates a transform step for the research pipeline
 *
 * @param options Configuration options for transformation
 * @returns A transform step for the research pipeline
 */
export function transform(options: TransformOptions = {}): ReturnType<typeof createStep> {
  return createStep(
    'Transform',
    async (state: ResearchState) => {
      return executeTransformStep(state, options);
    },
    options
  );
}
