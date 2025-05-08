/**
 * Example demonstrating parallel research tracks
 * 
 * This example shows how to use parallel research tracks to efficiently
 * gather information from multiple angles and combine the results.
 */
import { research, plan, searchWeb, extractContent, track, parallel, factCheck, analyze, summarize } from '../src';
import { ResultMerger } from '../src/utils/merge';
import { z } from 'zod';
import { google, brave } from '@plust/search-sdk';

// Configure search providers (using environment variables for API keys)
const googleSearch = google.configure({
  apiKey: process.env.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY',
  cx: process.env.GOOGLE_CX || 'YOUR_GOOGLE_CX'
});

const braveSearch = brave.configure({
  apiKey: process.env.BRAVE_API_KEY || 'YOUR_BRAVE_API_KEY'
});

/**
 * Output schema for research on emerging technologies
 */
const techResearchSchema = z.object({
  technology: z.string(),
  summary: z.string(),
  advantages: z.array(z.string()),
  challenges: z.array(z.string()),
  keyPlayers: z.array(z.object({
    name: z.string(),
    role: z.string(),
    significance: z.string().optional()
  })),
  timeline: z.array(z.object({
    year: z.number(),
    development: z.string()
  })).optional(),
  marketPotential: z.string(),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    relevance: z.number().min(0).max(1).optional()
  }))
});

/**
 * Run parallel research on emerging technologies
 */
async function runParallelResearch() {
  console.log('Starting parallel research on quantum computing...');
  
  try {
    const results = await research({
      query: "Latest advancements in quantum computing",
      outputSchema: techResearchSchema,
      steps: [
        // Start with a research plan
        plan(),
        
        // Execute parallel research tracks
        parallel({
          tracks: [
            // Track 1: Technical research using Google Search
            track({
              name: 'technical',
              description: 'Research technical aspects and scientific advancements',
              steps: [
                searchWeb({ 
                  provider: googleSearch, 
                  maxResults: 5,
                  query: "quantum computing technical advancements scientific breakthroughs" 
                }),
                extractContent(),
                factCheck({ threshold: 0.7 }),
                analyze({ focus: 'technical-details' })
              ]
            }),
            
            // Track 2: Business research using Brave Search
            track({
              name: 'business',
              description: 'Research business aspects, market adoption and companies',
              steps: [
                searchWeb({ 
                  provider: braveSearch, 
                  maxResults: 5,
                  query: "quantum computing companies market growth investment" 
                }),
                extractContent(),
                factCheck({ threshold: 0.7 }),
                analyze({ focus: 'market-trends' })
              ]
            }),
            
            // Track 3: Challenges and limitations research
            track({
              name: 'challenges',
              description: 'Research current challenges and limitations',
              steps: [
                searchWeb({ 
                  provider: googleSearch, 
                  maxResults: 5,
                  query: "quantum computing challenges limitations problems decoherence" 
                }),
                extractContent(),
                factCheck({ threshold: 0.7 }),
                analyze({ focus: 'challenges' })
              ]
            })
          ],
          // Use the ResultMerger utility to combine results with a custom merge strategy
          mergeFunction: ResultMerger.createMergeFunction({
            strategy: 'mostConfident',
            // Add more weight to the technical track for technical aspects
            weights: {
              technical: 1.5,
              business: 1.0,
              challenges: 1.0
            }
          })
        }),
        
        // Summarize the combined findings
        summarize({
          format: 'structured',
          maxLength: 1000
        })
      ]
    });
    
    console.log('Research completed successfully!');
    console.log(JSON.stringify(results, null, 2));
    
    return results;
  } catch (error) {
    console.error('Research failed:', error);
    throw error;
  }
}

// Run the example
runParallelResearch()
  .then(() => console.log('Example completed'))
  .catch(err => console.error('Example failed:', err));