/**
 * @plust/datasleuth
 * 
 * A powerful deep research tool for gathering and synthesizing information with AI.
 * This package enables developers to perform comprehensive research on any topic with 
 * a simple functional API, returning structured results based on a specified schema.
 * 
 * @packageDocumentation
 * @module datasleuth
 * 
 * @example
 * ```typescript
 * import { research } from '@plust/datasleuth';
 * import { z } from 'zod';
 * 
 * // Define your output schema
 * const outputSchema = z.object({
 *   summary: z.string(),
 *   keyFindings: z.array(z.string()),
 *   sources: z.array(z.string().url())
 * });
 * 
 * // Execute research
 * const results = await research({
 *   query: "Latest advancements in quantum computing",
 *   outputSchema
 * });
 * ```
 */

// Core functionality
export { research } from './core/research';
export { executePipeline, createInitialState } from './core/pipeline';

// Research steps
export { plan } from './steps/plan';
export { searchWeb } from './steps/searchWeb';
export { extractContent } from './steps/extractContent';
export { evaluate, repeatUntil } from './steps/flowControl';
export { orchestrate } from './steps/orchestrate';
export { factCheck } from './steps/factCheck';
export { summarize } from './steps/summarize';
export { refineQuery } from './steps/refineQuery';
export { analyze } from './steps/analyze';
export { track } from './steps/track';
export { parallel, defaultMergeFunction } from './steps/parallel';
export { classify } from './steps/classify';

// Utilities
export { ResultMerger } from './utils/merge';

// Types
export type { 
  ResearchState, 
  ResearchStep, 
  PipelineConfig,
  ResearchInput
} from './types/pipeline';

export type {
  ResearchPlan,
  PlanOptions
} from './steps/plan';

export type {
  WebSearchOptions,
  SearchResult
} from './steps/searchWeb';

export type {
  ExtractContentOptions,
  ExtractedContent
} from './steps/extractContent';

export type {
  EvaluateOptions,
  RepeatUntilOptions
} from './steps/flowControl';

export type {
  OrchestrateOptions
} from './steps/orchestrate';

export type {
  FactCheckOptions,
  FactCheckResult
} from './steps/factCheck';

export type {
  SummarizeOptions
} from './steps/summarize';

export type {
  RefineQueryOptions,
  RefinedQuery
} from './steps/refineQuery';

export type {
  AnalyzeOptions,
  AnalysisResult
} from './steps/analyze';

export type {
  TrackOptions,
  TrackResult
} from './steps/track';

export type {
  ParallelOptions
} from './steps/parallel';

export type {
  ConflictResolutionOptions
} from './utils/merge';

export type {
  ClassifyOptions,
  Entity,
  EntityCluster as Cluster,
  ClassificationData as ClassificationResult
} from './steps/classify';