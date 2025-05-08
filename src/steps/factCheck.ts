/**
 * Fact-checking step for the research pipeline
 * Validates information using LLMs and external sources
 */
import * as mastra from 'mastra';
import { createStep } from '../utils/steps';
import { ResearchState, FactCheckResult as StateFactCheckResult, ExtractedContent as StateExtractedContent } from '../types/pipeline';
import { StepOptions } from '../types/pipeline';
import { z } from 'zod';
import { AIModel } from './plan';

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
  /** Model to use for fact checking */
  model?: AIModel;
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
  
  // For now, simulate fact checking results
  // In a real implementation, this would use an LLM to validate statements
  const factCheckResults: StateFactCheckResult[] = await simulateFactChecking(
    statementsToCheck,
    threshold,
    includeEvidence
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
 * Simulates fact checking using an LLM
 * In a real implementation, this would call an actual LLM
 */
async function simulateFactChecking(
  statements: string[],
  threshold: number,
  includeEvidence: boolean
): Promise<StateFactCheckResult[]> {
  // Simulate a delay as if we're calling an LLM
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate simulated results
  return statements.map(statement => {
    // Randomly determine validity, slightly biased toward true
    const isValid = Math.random() > 0.3;
    const confidence = 0.6 + Math.random() * 0.4; // Between 0.6 and 1.0
    
    const result: StateFactCheckResult = {
      statement,
      isValid,
      confidence,
    };
    
    // Add evidence if requested
    if (includeEvidence) {
      result.evidence = [
        isValid
          ? `This statement appears to be accurate based on available information.`
          : `This statement contains inaccuracies or cannot be verified.`,
        `Confidence level: ${(confidence * 100).toFixed(1)}%`,
      ];
      
      // Add sample sources
      result.sources = [
        'https://example.com/source1',
        'https://example.com/source2',
      ];
      
      // Add corrections for invalid statements
      if (!isValid) {
        result.corrections = `A more accurate statement would be: ${statement.replace(
          /\b(all|never|always|impossible|definitely)\b/gi,
          match => {
            const replacements: Record<string, string> = {
              all: 'most',
              never: 'rarely',
              always: 'often',
              impossible: 'challenging',
              definitely: 'likely',
            };
            return replacements[match.toLowerCase()] || match;
          }
        )}`;
      }
    }
    
    return result;
  });
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