/**
 * Fact-checking step for the research pipeline
 * Validates information using LLMs and external sources
 */
import * as mastra from 'mastra';
import { createStep } from '../utils/steps';
import { ResearchState, FactCheckResult as StateFactCheckResult, ExtractedContent as StateExtractedContent } from '../types/pipeline';
import { StepOptions } from '../types/pipeline';
import { z } from 'zod';
import { generateText, LanguageModel } from 'ai';

/**
 * Schema for fact check results
 */
const factCheckResultSchema = z.object({
  statement: z.string(),
  isValid: z.boolean(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).optional(),
  sources: z.array(z.string().url()).optional(),
  corrections: z.string().optional(),
});

export type FactCheckResult = z.infer<typeof factCheckResultSchema>;

/**
 * Options for the fact checking step
 */
export interface FactCheckOptions extends StepOptions {
  /** Minimum confidence threshold for validation (0.0 to 1.0) */
  threshold?: number;
  /** Model to use for fact checking (from the AI SDK) */
  llm?: LanguageModel;
  /** Whether to include evidence in the output */
  includeEvidence?: boolean;
  /** Whether to include fact check results in the final results */
  includeInResults?: boolean;
  /** Specific statements to check (if empty, will extract from content) */
  statements?: string[];
  /** Maximum number of statements to check */
  maxStatements?: number;
  /** Custom prompt for the fact-checking LLM */
  customPrompt?: string;
  /** Temperature for the LLM (0.0 to 1.0) */
  temperature?: number;
}

/**
 * Default fact checking prompt
 */
const DEFAULT_FACT_CHECK_PROMPT = `
You are a critical fact-checker. Your task is to verify the accuracy of the following statements
based on the provided context and your knowledge.

For each statement, determine:
1. Whether the statement is factually accurate
2. Your confidence in this assessment (0.0-1.0)
3. Evidence supporting your assessment
4. Suggested corrections for inaccurate statements

Be as objective as possible. If you're uncertain, indicate a lower confidence score.
`;

/**
 * Executes fact checking on content
 */
async function executeFactCheckStep(
  state: ResearchState,
  options: FactCheckOptions
): Promise<ResearchState> {
  const {
    threshold = 0.7,
    llm,
    temperature = 0.3,
    includeEvidence = true,
    includeInResults = true,
    statements = [],
    maxStatements = 10,
    customPrompt,
  } = options;

  // Get statements to fact check
  let statementsToCheck: string[] = [...statements];
  
  // If no statements provided, extract from content
  if (statementsToCheck.length === 0 && state.data.extractedContent) {
    statementsToCheck = await extractStatementsFromContent(
      state.data.extractedContent,
      maxStatements
    );
  }
  
  if (statementsToCheck.length === 0) {
    console.warn('No statements found for fact checking');
    return state;
  }

  console.log(`Fact checking ${statementsToCheck.length} statements...`);
  
  // Check for an LLM to use - either from options or from state
  const modelToUse = llm || state.defaultLLM;
  
  // If no LLM is available, throw an error
  if (!modelToUse) {
    throw new Error(
      "No language model provided for fact checking step. Please provide an LLM either in the step options or as a defaultLLM in the research function."
    );
  }

  // Perform fact checking using the LLM
  const factCheckResults = await performFactCheckingWithLLM(
    statementsToCheck,
    threshold,
    includeEvidence,
    modelToUse,
    temperature,
    customPrompt
  );
  
  // Calculate overall factual accuracy score
  const validStatements = factCheckResults.filter(result => result.isValid);
  const factualAccuracyScore = validStatements.length / factCheckResults.length;
  
  // Update state with fact check results
  const newState = {
    ...state,
    data: {
      ...state.data,
      factChecks: factCheckResults,
      factualAccuracyScore,
    },
    metadata: {
      ...state.metadata,
      confidenceScore: Math.max(
        state.metadata.confidenceScore || 0,
        factualAccuracyScore
      ),
    },
  };

  // Add to results if requested
  if (includeInResults) {
    return {
      ...newState,
      results: [
        ...newState.results,
        {
          factChecks: factCheckResults,
          factualAccuracyScore,
        },
      ],
    };
  }

  return newState;
}

/**
 * Extracts statements from content for fact checking
 * In a real implementation, this would use NLP or an LLM
 */
async function extractStatementsFromContent(
  extractedContent: StateExtractedContent[],
  maxStatements: number
): Promise<string[]> {
  // Simulate extraction by splitting content into sentences
  const statements: string[] = [];
  
  // Process each content item
  for (const content of extractedContent) {
    if (!content.content) continue;
    
    // Simple sentence splitting - in real implementation use NLP
    const sentences = content.content
      .split(/[.!?]/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 20 && s.length < 200);
    
    // Add sentences to statements array
    for (const sentence of sentences) {
      if (statements.length >= maxStatements) break;
      if (!statements.includes(sentence)) {
        statements.push(sentence);
      }
    }
    
    if (statements.length >= maxStatements) break;
  }
  
  return statements;
}

/**
 * Performs fact checking using an LLM from the AI SDK
 */
async function performFactCheckingWithLLM(
  statements: string[],
  threshold: number,
  includeEvidence: boolean,
  llm: LanguageModel,
  temperature: number,
  customPrompt?: string
): Promise<StateFactCheckResult[]> {
  const results: StateFactCheckResult[] = [];
  const systemPrompt = customPrompt || DEFAULT_FACT_CHECK_PROMPT;
  
  // Process each statement individually to maintain detailed control
  for (const statement of statements) {
    try {
      const factCheckPrompt = `
Statement to verify: "${statement}"

Analyze this statement for factual accuracy, and provide your assessment in valid JSON format:
{
  "statement": "${statement}",
  "isValid": true/false,
  "confidence": 0.XX, // number between 0 and 1
  ${includeEvidence ? `"evidence": ["reason 1", "reason 2", ...],
  "sources": ["https://example.com/source1", "https://example.com/source2", ...],
  "corrections": "If statement is not valid, provide a corrected version here"` : ''}
}

Ensure your response is valid JSON and properly formatted with no trailing commas.
`;

      // Generate the fact check using the AI SDK
      const { text } = await generateText({
        model: llm,
        system: systemPrompt,
        prompt: factCheckPrompt,
        temperature,
      });

      // Parse the JSON response
      try {
        const parsedResult = JSON.parse(text);
        
        // Validate the result with our schema
        const validatedResult = factCheckResultSchema.parse(parsedResult);
        
        // Only add results that meet our confidence threshold
        if (validatedResult.confidence >= threshold) {
          results.push(validatedResult);
        } else {
          console.log(`Statement skipped due to low confidence (${validatedResult.confidence}): ${statement}`);
        }
      } catch (parseError) {
        console.error('Failed to parse LLM response as valid JSON for fact checking:', parseError);
        console.debug('Raw LLM response:', text);
        
        // Add a fallback result for this statement
        results.push({
          statement,
          isValid: false,
          confidence: 0.5,
          evidence: ['Failed to parse LLM response'],
          corrections: 'Unable to verify this statement due to processing error'
        });
      }
    } catch (error: unknown) {
      console.error('Error performing fact check with LLM:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Add a fallback result
      results.push({
        statement,
        isValid: false,
        confidence: 0.5,
        evidence: [`Error: ${errorMessage}`],
        corrections: 'Unable to verify this statement due to an error'
      });
    }
  }
  
  return results;
}

/**
 * Creates a fact checking step for the research pipeline
 * 
 * @param options Configuration options for fact checking
 * @returns A fact checking step for the research pipeline
 */
export function factCheck(options: FactCheckOptions = {}): ReturnType<typeof createStep> {
  return createStep('FactCheck', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: StepOptions) => {
      return executeFactCheckStep(state, options);
    }, 
    options
  );
}