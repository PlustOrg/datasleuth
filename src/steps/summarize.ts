/**
 * Summarization step for the research pipeline
 * Synthesizes information into concise summaries using LLMs
 */
import * as mastra from 'mastra';
import { createStep } from '../utils/steps';
import { ResearchState } from '../types/pipeline';
import { z } from 'zod';

/**
 * Options for the summarization step
 */
export interface SummarizeOptions {
  /** Maximum length of the generated summary (characters) */
  maxLength?: number;
  /** Model to use for summarization */
  model?: any;
  /** Temperature for the LLM generation (0.0 to 1.0) */
  temperature?: number;
  /** Format for the summary (paragraph, bullet, structured) */
  format?: 'paragraph' | 'bullet' | 'structured';
  /** Focus areas for the summary (aspects to emphasize) */
  focus?: string[];
  /** Whether to include citations in the summary */
  includeCitations?: boolean;
  /** Whether to add the summary to the final results */
  includeInResults?: boolean;
  /** Custom prompt for summary generation */
  customPrompt?: string;
  /** Additional instructions for summary generation */
  additionalInstructions?: string;
}

/**
 * Default summarization prompt
 */
const DEFAULT_SUMMARIZE_PROMPT = `
You are an expert research synthesizer. Your task is to create a comprehensive summary
of the provided information.

Create a well-structured summary that:
1. Captures the key points and insights
2. Presents information in a logical flow
3. Maintains factual accuracy
4. Highlights areas of consensus and disagreement
5. Notes any limitations in the research

Your summary should be concise yet thorough, prioritizing the most important findings.
`;

/**
 * Executes the summarization step
 */
async function executeSummarizeStep(
  state: ResearchState,
  options: SummarizeOptions
): Promise<ResearchState> {
  const {
    maxLength = 2000,
    temperature = 0.3,
    format = 'paragraph',
    focus = [],
    includeCitations = true,
    includeInResults = true,
    customPrompt,
    additionalInstructions,
  } = options;

  // Get content to summarize
  const contentToSummarize = [];
  
  // Add extracted content if available
  if (state.data.extractedContent) {
    contentToSummarize.push(...state.data.extractedContent.map((item: any) => item.content));
  }
  
  // Add research plan if available
  if (state.data.researchPlan) {
    contentToSummarize.push(JSON.stringify(state.data.researchPlan));
  }
  
  // Add factual information if available
  if (state.data.factChecks) {
    const validFactChecks = state.data.factChecks.filter((check: any) => check.isValid);
    contentToSummarize.push(...validFactChecks.map((check: any) => check.statement));
  }
  
  if (contentToSummarize.length === 0) {
    console.warn('No content found for summarization');
    return state;
  }

  console.log(`Summarizing ${contentToSummarize.length} content items...`);
  
  // For now, simulate summary generation
  // In a real implementation, this would use an LLM to generate a summary
  const summary = await simulateSummaryGeneration(
    contentToSummarize,
    state.query,
    maxLength,
    format,
    focus,
    includeCitations,
    additionalInstructions
  );
  
  // Update state with summary
  const newState = {
    ...state,
    data: {
      ...state.data,
      summary,
    },
  };

  // Add to results if requested
  if (includeInResults) {
    return {
      ...newState,
      results: [
        ...newState.results,
        { summary },
      ],
    };
  }

  return newState;
}

/**
 * Simulates summary generation using an LLM
 * In a real implementation, this would call an actual LLM
 */
async function simulateSummaryGeneration(
  contentItems: string[],
  query: string,
  maxLength: number,
  format: string,
  focus: string[],
  includeCitations: boolean,
  additionalInstructions?: string
): Promise<string> {
  // Simulate a delay as if we're calling an LLM
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Generate a simulated summary based on the query and format
  const queryTerms = query.toLowerCase().split(/\s+/);
  const focusTerms = focus.flatMap(f => f.toLowerCase().split(/\s+/));
  const allTerms = [...new Set([...queryTerms, ...focusTerms])];
  
  // Create intro paragraph
  let summary = `Based on comprehensive research on ${query}, several key insights emerge. `;
  summary += `The findings indicate significant developments in this area with implications for various sectors. `;
  
  // Add simulated content based on the query
  const contentParagraphs = [
    `Research shows that ${query} has been a topic of increasing interest in recent years. `,
    `Multiple sources confirm the importance of ${query} in contemporary contexts. `,
    `Experts in the field have emphasized the need for further investigation into ${query}. `,
    `Analysis of available data reveals patterns related to ${query} that merit attention. `,
    `The evolution of ${query} demonstrates both challenges and opportunities for stakeholders. `,
  ];
  
  // Add additional instructions-based content if provided
  if (additionalInstructions) {
    summary += `\nFollowing specific analysis directives: ${additionalInstructions.substring(0, 100)}... `;
  }
  
  // Add focus-specific content if specified
  if (focus.length > 0) {
    summary += `Particularly noteworthy aspects include ${focus.join(', ')}. `;
    
    for (const focusArea of focus) {
      summary += `Regarding ${focusArea}, the research indicates notable trends and considerations. `;
    }
  }
  
  // Add content paragraphs
  if (format === 'paragraph') {
    // Add content paragraphs for paragraph format
    for (const paragraph of contentParagraphs) {
      if (summary.length + paragraph.length < maxLength) {
        summary += paragraph;
      }
    }
    
    // Add conclusion
    if (summary.length + 100 < maxLength) {
      summary += `In conclusion, the research on ${query} points to evolving understanding and applications. `;
      summary += `Future developments will likely build on these foundations while addressing current limitations.`;
    }
  } else if (format === 'bullet') {
    // Format as bullet points
    summary += `\n\nKey findings include:\n\n`;
    
    for (let i = 0; i < contentParagraphs.length; i++) {
      const bullet = `• ${contentParagraphs[i]}`;
      if (summary.length + bullet.length < maxLength) {
        summary += bullet;
      }
    }
  } else if (format === 'structured') {
    // Format as structured summary with sections
    summary += `\n\n## Key Findings\n\n`;
    for (let i = 0; i < Math.min(contentParagraphs.length, 3); i++) {
      if (summary.length + contentParagraphs[i].length + 20 < maxLength) {
        summary += `### Point ${i + 1}\n${contentParagraphs[i]}\n\n`;
      }
    }
    
    // Add implications section
    if (summary.length + 150 < maxLength) {
      summary += `## Implications\n\nThe research has significant implications for various stakeholders, `;
      summary += `suggesting potential directions for future work and applications.`;
    }
  }
  
  // Add citations if requested
  if (includeCitations) {
    if (summary.length + 100 < maxLength) {
      summary += `\n\n## Sources\n\n`;
      summary += `1. Smith, J. (2024). Understanding ${query}. Journal of Research Studies.\n`;
      summary += `2. Brown, A. et al. (2025). Advances in ${query}. International Conference Proceedings.\n`;
    }
  }
  
  // Ensure we're within the max length
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength - 3) + '...';
  }
  
  return summary;
}

/**
 * Creates a summarization step for the research pipeline
 * 
 * @param options Configuration options for summarization
 * @returns A summarization step for the research pipeline
 */
export function summarize(options: SummarizeOptions = {}): ReturnType<typeof createStep> {
  return createStep('Summarize', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeSummarizeStep(state, options);
    }, 
    options
  );
}