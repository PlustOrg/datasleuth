/**
 * Orchestration-based research example
 * Demonstrates using mastra agents to make dynamic decisions about research steps
 */
import { 
  research, 
  orchestrate, 
  plan,
  searchWeb, 
  extractContent
} from '../src';
import { z } from 'zod';

async function orchestrationResearch() {
  console.log('Running orchestration-based research example...');
  
  try {
    // Define the output schema for our research
    const outputSchema = z.object({
      marketOverview: z.string(),
      technologies: z.array(z.object({
        name: z.string(),
        maturityLevel: z.enum(['research', 'emerging', 'growth', 'mature']),
        costEfficiency: z.number().min(1).max(10),
        scalabilityPotential: z.number().min(1).max(10),
        keyPlayers: z.array(z.string())
      })),
      forecast: z.object({
        shortTerm: z.string(),
        mediumTerm: z.string(),
        longTerm: z.string()
      }),
      investmentOpportunities: z.array(z.string()),
      sources: z.array(z.object({
        url: z.string().url(),
        type: z.enum(['academic', 'news', 'company', 'government']),
        relevance: z.number().min(0).max(1)
      }))
    });

    // Mock configuration for search providers
    // In a real implementation, these would use real API keys
    const mockWebSearch = {
      apiKey: 'mock-web-api-key',
      name: 'google'
    };
    
    const mockAcademicSearch = {
      apiKey: 'mock-academic-api-key',
      name: 'scholar'
    };
    
    // Mock configuration for LLM model
    // In a real implementation, this would use a real AI SDK instance
    const mockModel = {
      name: 'gpt-4-turbo',
      provider: 'openai'
    };

    // Mock search providers with configure methods
    const webSearchProvider = {
      configure: () => mockWebSearch
    };
    
    const academicSearchProvider = {
      configure: () => mockAcademicSearch
    };
    
    const configuredWebSearch = webSearchProvider.configure();
    const configuredAcademicSearch = academicSearchProvider.configure();

    // Execute the research with orchestration
    const results = await research({
      query: "Emerging technologies in renewable energy storage",
      outputSchema,
      steps: [
        // Use a planning step first to set objectives
        plan({ includeInResults: true }),
        
        // Then use orchestration to dynamically choose tools
        orchestrate({
          model: mockModel,
          tools: {
            searchWeb: searchWeb({ provider: configuredWebSearch }),
            searchAcademic: searchWeb({ provider: configuredAcademicSearch }),
            extractContent: extractContent(),
            // In a real implementation, these would be actual analysis tools
            analyzeMarket: createMockAnalysisTool('market-trends'),
            analyzeTechnology: createMockAnalysisTool('technical-details'),
            compareSolutions: createMockComparisonTool()
          },
          customPrompt: `
            You are conducting market research on emerging renewable energy storage technologies.
            Your goal is to build a comprehensive market overview with technical assessment.
          `,
          maxIterations: 5,
          exitCriteria: (state) => {
            // Exit when we have enough data points (simulated here)
            const dataPoints = state.data.extractedContent?.length || 0;
            const confidence = state.metadata.confidenceScore || 0;
            return dataPoints > 5 && confidence > 0.7;
          }
        })
      ],
      config: {
        errorHandling: 'continue',
        timeout: 120000 // 2 minutes
      }
    });
    
    console.log('Research completed successfully!');
    console.log(JSON.stringify(results, null, 2));
    
    return results;
  } catch (error) {
    console.error('Research failed:', error);
    throw error;
  }
}

// Mock analysis tool for demonstration purposes
function createMockAnalysisTool(focus: string) {
  return {
    name: `Analysis-${focus}`,
    execute: async (state) => {
      console.log(`Executing analysis with focus: ${focus}`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        ...state,
        data: {
          ...state.data,
          analysis: {
            ...(state.data.analysis || {}),
            [focus]: {
              completed: true,
              timestamp: new Date().toISOString(),
              insights: [`Mock insight for ${focus}`],
            }
          }
        }
      };
    }
  };
}

// Mock comparison tool for demonstration purposes
function createMockComparisonTool() {
  return {
    name: 'Comparison',
    execute: async (state) => {
      console.log('Executing comparison tool');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        ...state,
        data: {
          ...state.data,
          comparison: {
            completed: true,
            timestamp: new Date().toISOString(),
            results: ['Mock comparison result']
          }
        }
      };
    }
  };
}

// Execute if run directly
if (require.main === module) {
  orchestrationResearch()
    .then(() => console.log('Example finished'))
    .catch(err => console.error('Example failed:', err));
}

export default orchestrationResearch;