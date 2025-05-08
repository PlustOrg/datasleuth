/**
 * Example demonstrating entity classification features
 * 
 * This example shows how to use entity classification and clustering
 * to organize research findings into a coherent knowledge graph.
 */
import { research, plan, searchWeb, extractContent, classify, summarize } from '../src';
import { z } from 'zod';
import { google } from '@plust/search-sdk';

// Configure search provider
const googleSearch = google.configure({
  apiKey: process.env.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY',
  cx: process.env.GOOGLE_CX || 'YOUR_GOOGLE_CX'
});

/**
 * Output schema for classified research data
 */
const classifiedResearchSchema = z.object({
  summary: z.string(),
  topEntities: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1)
  })),
  entityRelationships: z.array(z.object({
    source: z.string(),
    target: z.string(),
    relationship: z.string()
  })),
  clusters: z.array(z.object({
    name: z.string(),
    theme: z.string(),
    entities: z.array(z.string())
  })),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string()
  }))
});

/**
 * Run research with entity classification
 */
async function runClassificationExample() {
  console.log('Starting research with entity classification...');
  
  try {
    const results: any = await research({
      query: "Space exploration achievements in the last decade",
      outputSchema: classifiedResearchSchema,
      steps: [
        // Plan the research approach
        plan(),
        
        // Search and extract content
        searchWeb({ 
          provider: googleSearch, 
          maxResults: 8
        }),
        extractContent(),
        
        // Perform entity classification and clustering
        classify({
          classifyEntities: true,
          clusterEntities: true,
          customEntityTypes: [
            'space_mission',
            'space_agency',
            'celestial_body',
            'spacecraft',
            'astronaut',
            'scientific_discovery'
          ],
          confidenceThreshold: 0.7
        }),
        
        // Summarize the findings with entity information
        summarize({
          format: 'structured',
          maxLength: 1000,
          // Include instruction to incorporate entity information
          additionalInstructions: `
            Use the classified entities and clusters to structure the summary.
            Highlight the most significant entities and their relationships.
            Group information by entity clusters where appropriate.
          `
        })
      ]
    });
    
    console.log('Research with classification completed successfully!');
    
    // Display the classified entities
    if (results.data && results.data.classification && results.data.classification.entities) {
      console.log(`\nFound ${Object.keys(results.data.classification.entities).length} entities`);
      
      const topEntities = Object.values(results.data.classification.entities)
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .slice(0, 5);
      
      console.log('\nTop 5 Entities:');
      topEntities.forEach((entity: any) => {
        console.log(`- ${entity.name} (${entity.type}): confidence ${entity.confidence.toFixed(2)}`);
      });
    }
    
    // Display the entity clusters
    if (results.data && results.data.classification && results.data.classification.clusters) {
      console.log(`\nFound ${Object.keys(results.data.classification.clusters).length} clusters`);
      
      console.log('\nEntity Clusters:');
      Object.values(results.data.classification.clusters).forEach((cluster: any) => {
        console.log(`- ${cluster.name} (${cluster.entities.length} entities)`);
      });
    }
    
    return results;
  } catch (error) {
    console.error('Research failed:', error);
    throw error;
  }
}

// Run the example
runClassificationExample()
  .then(() => console.log('Example completed'))
  .catch(err => console.error('Example failed:', err));