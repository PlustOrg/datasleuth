/**
 * Comprehensive research example
 * Demonstrates a complex research pipeline with all available steps
 */
import { 
  research,
  plan,
  searchWeb,
  extractContent,
  factCheck,
  analyze,
  refineQuery,
  evaluate,
  repeatUntil,
  summarize,
  orchestrate
} from '../src';
import { z } from 'zod';

async function comprehensiveResearch() {
  console.log('Running comprehensive research example...');
  
  try {
    // Define a complex output schema for detailed market and technology research
    const outputSchema = z.object({
      summary: z.string(),
      keyFindings: z.array(z.string()),
      marketAnalysis: z.object({
        size: z.string(),
        growth: z.string(),
        trends: z.array(z.string()),
        keyPlayers: z.array(z.object({
          name: z.string(),
          marketShare: z.string().optional(),
          strengths: z.array(z.string()).optional()
        }))
      }),
      technicalAnalysis: z.object({
        currentState: z.string(),
        innovations: z.array(z.string()),
        challenges: z.array(z.string()),
        futureDirections: z.array(z.string())
      }),
      strategicImplications: z.array(z.string()),
      sources: z.array(z.object({
        title: z.string(),
        url: z.string().url(),
        publishedDate: z.string().optional(),
        credibilityScore: z.number().min(0).max(1).optional()
      }))
    });

    // Mock configuration for search providers (in a real implementation, users would configure this)
    const mockWebSearch = {
      name: 'google',
      apiKey: 'mock-web-api-key'
    };
    
    const mockAcademicSearch = {
      name: 'scholar',
      apiKey: 'mock-academic-api-key'
    };
    
    // Mock AI model for LLM operations
    const mockModel = {
      name: 'gpt-4-turbo',
      provider: 'openai'
    };

    // Execute comprehensive research with a multi-stage pipeline
    const results = await research({
      query: "Future of quantum computing in pharmaceutical drug discovery",
      outputSchema,
      steps: [
        // 1. Initial Research Planning
        plan({
          model: mockModel,
          includeInResults: false
        }),
        
        // 2. Initial Web Search with Multiple Queries
        searchWeb({
          provider: mockWebSearch,
          maxResults: 10,
          useQueriesFromPlan: true,
          includeInResults: false
        }),
        
        // 3. Content Extraction from Initial Search
        extractContent({
          maxUrls: 5,
          maxContentLength: 10000,
          includeInResults: false
        }),
        
        // 4. Initial Fact Checking
        factCheck({
          model: mockModel,
          threshold: 0.7,
          includeEvidence: true,
          includeInResults: false
        }),
        
        // 5. Evaluate Data Sufficiency and Quality
        // This creates a conditional path that triggers additional searches if needed
        repeatUntil(
          evaluate({
            criteriaFn: (state) => {
              // Check if we have enough high-quality data
              const extractedContent = state.data.extractedContent || [];
              const factChecks = state.data.factChecks || [];
              const validFacts = factChecks.filter(check => check.isValid);
              
              // Calculate factual accuracy score
              const factualAccuracy = factChecks.length > 0 
                ? validFacts.length / factChecks.length 
                : 0;
              
              // Determine if we have enough quality data
              return extractedContent.length >= 3 && factualAccuracy >= 0.7;
            },
            criteriaName: 'DataQualityCheck',
            confidenceThreshold: 0.8
          }),
          [
            // If quality check fails, refine the query and search again
            refineQuery({ 
              model: mockModel,
              basedOn: 'factuality',
              maxQueries: 2
            }),
            searchWeb({
              provider: mockWebSearch,
              maxResults: 5,
              includeInResults: false
            }),
            extractContent({
              maxUrls: 3,
              includeInResults: false
            }),
            factCheck({
              model: mockModel,
              threshold: 0.7,
              includeInResults: false
            })
          ],
          { maxIterations: 2 }
        ),
        
        // 6. Specialized Academic Search
        searchWeb({
          provider: mockAcademicSearch,
          maxResults: 5,
          includeInResults: false
        }),
        
        extractContent({
          maxUrls: 3,
          includeInResults: false
        }),
        
        // 7. Specialized Analysis Steps
        // Market Analysis
        analyze({
          model: mockModel,
          focus: 'market-trends',
          depth: 'comprehensive',
          includeEvidence: true,
          includeRecommendations: true,
          includeInResults: false
        }),
        
        // Technical Analysis
        analyze({
          model: mockModel,
          focus: 'technical-details',
          depth: 'comprehensive',
          includeEvidence: true,
          includeRecommendations: true,
          includeInResults: false
        }),
        
        // 8. Evaluate Analytical Sufficiency
        repeatUntil(
          evaluate({
            criteriaFn: (state) => {
              // Check if we have comprehensive analysis in both market and technical areas
              const analysis = state.data.analysis || {};
              return analysis['market-trends'] && analysis['technical-details'];
            },
            criteriaName: 'AnalysisSufficiencyCheck'
          }),
          [
            // Fill in missing analysis if needed
            refineQuery({
              model: mockModel,
              basedOn: 'gaps',
              maxQueries: 1
            }),
            searchWeb({
              provider: mockWebSearch,
              maxResults: 3,
              includeInResults: false
            }),
            extractContent({
              maxUrls: 2,
              includeInResults: false
            }),
            analyze({
              model: mockModel,
              focus: 'comprehensive',
              depth: 'detailed',
              includeInResults: false
            })
          ],
          { maxIterations: 1 }
        ),
        
        // 9. Final Comprehensive Summarization
        summarize({
          model: mockModel,
          maxLength: 3000,
          format: 'structured',
          focus: ['market implications', 'technical feasibility', 'timeframe'],
          includeCitations: true,
          includeInResults: true
        })
      ],
      config: {
        errorHandling: 'continue',
        timeout: 180000 // 3 minutes
      }
    });
    
    console.log('Comprehensive research completed successfully!');
    console.log(JSON.stringify(results, null, 2));
    
    return results;
  } catch (error) {
    console.error('Research failed:', error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  comprehensiveResearch()
    .then(() => console.log('Example finished'))
    .catch(err => console.error('Example failed:', err));
}

export default comprehensiveResearch;