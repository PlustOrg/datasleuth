/**
 * Entity classification and clustering step implementation
 * This module provides advanced entity recognition, classification and clustering
 * capabilities to organize research findings into a coherent knowledge graph.
 */

import { createStep } from '../utils/steps';
import { ResearchState } from '../types/pipeline';
import { 
  ValidationError, 
  ConfigurationError, 
  LLMError,
  ProcessingError 
} from '../types/errors';
import { logger, createStepLogger } from '../utils/logging';
import { executeWithRetry } from '../utils/retry';

/**
 * Options for entity classification
 */
export interface ClassifyOptions {
  /**
   * Whether to identify and classify entities in the research data
   */
  classifyEntities?: boolean;
  
  /**
   * Whether to cluster identified entities by relationship
   */
  clusterEntities?: boolean;
  
  /**
   * Minimum confidence threshold for entity classification (0-1)
   */
  confidenceThreshold?: number;
  
  /**
   * Custom entity types to identify (in addition to standard types)
   */
  customEntityTypes?: string[];
  
  /**
   * Maximum number of entities to extract
   */
  maxEntities?: number;
  
  /**
   * Maximum number of clusters to generate
   */
  maxClusters?: number;
  
  /**
   * Custom instructions for entity clustering algorithm
   */
  clusteringInstructions?: string;

  /**
   * Retry configuration for LLM calls
   */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
  };
}

/**
 * Entity object structure
 */
export interface Entity {
  name: string;
  type: string;
  description: string;
  confidence: number;
  mentions: number;
  attributes?: Record<string, any>;
}

/**
 * Relationship between entities
 */
export interface EntityRelationship {
  source: string;
  target: string;
  relationship: string;
  confidence: number;
}

/**
 * Cluster of related entities
 */
export interface EntityCluster {
  name: string;
  description: string; // Changed from 'theme' to 'description' to match pipeline.ts
  entities: string[];
  confidence: number;
}

/**
 * Classification data structure
 */
export interface ClassificationData {
  entities: Record<string, Entity>;
  relationships: EntityRelationship[];
  clusters: Record<string, EntityCluster>;
}

/**
 * Execute the entity classification step
 * @param state - Current research state
 * @param options - Classification options
 * @returns Updated research state with classification data
 */
async function executeClassifyStep(
  state: ResearchState,
  options: ClassifyOptions
): Promise<ResearchState> {
  const stepLogger = createStepLogger('Classification');
  
  const {
    classifyEntities = true,
    clusterEntities = true,
    confidenceThreshold = 0.6,
    customEntityTypes = [],
    maxEntities = 50,
    maxClusters = 10,
    clusteringInstructions = '',
    retry = { maxRetries: 2, baseDelay: 1000 }
  } = options;
  
  stepLogger.info('Starting entity classification and clustering');
  
  try {
    // Validate confidence threshold
    if (confidenceThreshold < 0 || confidenceThreshold > 1) {
      throw new ValidationError({
        message: `Invalid confidence threshold: ${confidenceThreshold}. Must be between 0 and 1.`,
        step: 'Classification',
        details: { confidenceThreshold },
        suggestions: [
          "Confidence threshold must be between 0.0 and 1.0",
          "Recommended values are between 0.5 and 0.8"
        ]
      });
    }
    
    // Ensure we have data to classify
    if (!state.data.extractedContent || state.data.extractedContent.length === 0) {
      stepLogger.warn('No content available for classification');
      return {
        ...state,
        metadata: {
          ...state.metadata,
          warnings: [
            ...(state.metadata.warnings || []),
            'Classification step skipped due to missing content.'
          ]
        }
      };
    }
    
    stepLogger.debug(`Classifying content with ${clusterEntities ? 'clustering enabled' : 'clustering disabled'}`);
    
    // In a real implementation, this would use an LLM to classify entities
    // For now, we'll simulate the classification process with error handling
    const classificationData = await executeWithRetry(
      () => simulateEntityClassification(
        state.data.extractedContent!, // Safe to use ! here since we checked above
        state.query,
        {
          classifyEntities,
          clusterEntities,
          confidenceThreshold,
          customEntityTypes,
          maxEntities,
          maxClusters,
          clusteringInstructions,
          retry
        }
      ),
      {
        maxRetries: retry.maxRetries ?? 2,
        retryDelay: retry.baseDelay ?? 1000,
        backoffFactor: 2,
        onRetry: (attempt, error, delay) => {
          stepLogger.warn(`Retry attempt ${attempt} for classification: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying in ${delay}ms...`);
        }
      }
    );
    
    stepLogger.info(`Classification completed with ${Object.keys(classificationData.entities).length} entities, ${classificationData.relationships.length} relationships, and ${Object.keys(classificationData.clusters).length} clusters`);
    
    return {
      ...state,
      data: {
        ...state.data,
        classification: classificationData
      },
      metadata: {
        ...state.metadata,
        hasClassification: true,
        entityCount: Object.keys(classificationData.entities).length,
        clusterCount: Object.keys(classificationData.clusters).length,
        relationshipCount: classificationData.relationships.length
      }
    };
  } catch (error: unknown) {
    // Handle different error types appropriately
    if (error instanceof ValidationError || 
        error instanceof LLMError || 
        error instanceof ConfigurationError) {
      // These are already properly formatted, just throw them
      throw error;
    }
    
    // Handle generic errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    stepLogger.error(`Error during classification: ${errorMessage}`);
    
    // Check for specific error patterns
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      throw new LLMError({
        message: `Failed to parse LLM response during classification: ${errorMessage}`,
        step: 'Classification',
        details: { error },
        retry: true,
        suggestions: [
          "The LLM response could not be properly parsed",
          "Try a different model or temperature setting",
          "Check if the prompt is properly formatted for structured output"
        ]
      });
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      throw new LLMError({
        message: `LLM rate limit exceeded during classification: ${errorMessage}`,
        step: 'Classification',
        details: { error },
        retry: true,
        suggestions: [
          "Wait and try again later",
          "Consider using a different LLM provider",
          "Implement rate limiting in your application"
        ]
      });
    }
    
    // Generic processing error
    throw new ProcessingError({
      message: `Classification failed: ${errorMessage}`,
      step: 'Classification',
      details: { error, options },
      retry: true,
      suggestions: [
        "Check your classification configuration",
        "Try with a smaller set of content",
        "Reduce the complexity of clustering requirements"
      ]
    });
  }
}

/**
 * Simulate entity classification using an LLM
 * This will be replaced with an actual implementation using mastra and the ai SDK
 */
async function simulateEntityClassification(
  extractedContent: any[], // Changed from 'content: string[]' to accept ExtractedContent[]
  query: string,
  options: ClassifyOptions
): Promise<ClassificationData> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Extract actual text content from ExtractedContent objects
  const textContent = extractedContent.map(item => item.content || '').filter(Boolean);
  
  // Sample entities based on common topics - will be replaced with real LLM-based extraction
  const entities: Record<string, Entity> = {};
  const relationships: EntityRelationship[] = [];
  const clusters: Record<string, EntityCluster> = {};
  
  // Generate some sample entities based on the query
  // In a real implementation, these would be extracted from the content
  const queryWords = query.toLowerCase().split(' ');
  
  if (queryWords.includes('space') || queryWords.includes('exploration')) {
    entities['nasa'] = {
      name: 'NASA',
      type: 'organization',
      description: 'The National Aeronautics and Space Administration is America\'s civil space program and the global leader in space exploration.',
      confidence: 0.95,
      mentions: 12
    };
    
    entities['spacex'] = {
      name: 'SpaceX',
      type: 'company',
      description: 'Space Exploration Technologies Corp. is an American spacecraft manufacturer, space launch provider, and satellite communications company.',
      confidence: 0.92,
      mentions: 8
    };
    
    entities['mars'] = {
      name: 'Mars',
      type: 'celestial_body',
      description: 'The fourth planet from the Sun and the second-smallest planet in the Solar System.',
      confidence: 0.89,
      mentions: 7
    };
    
    // Add some relationships
    relationships.push(
      {
        source: 'nasa',
        target: 'mars',
        relationship: 'explores',
        confidence: 0.88
      },
      {
        source: 'spacex',
        target: 'mars',
        relationship: 'targets for exploration',
        confidence: 0.86
      }
    );
    
    // Add a cluster
    clusters['space_exploration'] = {
      name: 'Space Exploration',
      description: 'Organizations and targets involved in space exploration efforts',
      entities: ['nasa', 'spacex', 'mars'],
      confidence: 0.9
    };
  }
  
  if (queryWords.includes('climate') || queryWords.includes('environment')) {
    entities['climate_change'] = {
      name: 'Climate Change',
      type: 'concept',
      description: 'Long-term shifts in temperatures and weather patterns, primarily caused by human activities.',
      confidence: 0.93,
      mentions: 15
    };
    
    entities['ipcc'] = {
      name: 'IPCC',
      type: 'organization',
      description: 'The Intergovernmental Panel on Climate Change, the United Nations body for assessing the science related to climate change.',
      confidence: 0.91,
      mentions: 6
    };
    
    // Add relationships
    relationships.push(
      {
        source: 'ipcc',
        target: 'climate_change',
        relationship: 'studies',
        confidence: 0.92
      }
    );
    
    // Add a cluster
    clusters['climate_research'] = {
      name: 'Climate Research',
      description: 'Organizations and concepts related to climate science',
      entities: ['climate_change', 'ipcc'],
      confidence: 0.88
    };
  }
  
  // Include custom entity types if provided
  if (options.customEntityTypes && options.customEntityTypes.length > 0) {
    // This would normally extract entities of the specified types from the content
    // For now, just add a note in the metadata
    console.log(`Would extract custom entity types: ${options.customEntityTypes.join(', ')}`);
  }
  
  return {
    entities,
    relationships,
    clusters
  };
}

/**
 * Create a classification step
 * @param options - Classification options
 * @returns A configured classification step
 */
export function classify(options: ClassifyOptions = {}): ReturnType<typeof createStep> {
  return createStep('Classify', 
    // Wrapper function that matches the expected signature
    async (state: ResearchState, opts?: Record<string, any>) => {
      return executeClassifyStep(state, options);
    }, 
    options,
    {
      // Mark as retryable by default for the entire step
      retryable: true,
      maxRetries: options.retry?.maxRetries || 2,
      retryDelay: options.retry?.baseDelay || 1000,
      backoffFactor: 2
    }
  );
}