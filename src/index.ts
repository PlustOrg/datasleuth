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
export { research } from './core/research.js';
export { executePipeline, createInitialState } from './core/pipeline.js';

// Research steps
export { plan } from './steps/plan.js';
export { searchWeb } from './steps/searchWeb.js';
export { extractContent } from './steps/extractContent.js';
export { evaluate, repeatUntil } from './steps/flowControl.js';
export { orchestrate } from './steps/orchestrate.js';
export { factCheck } from './steps/factCheck.js';
export { summarize } from './steps/summarize.js';
export { refineQuery } from './steps/refineQuery.js';
export { analyze } from './steps/analyze.js';
export { track } from './steps/track.js';
export { parallel, defaultMergeFunction } from './steps/parallel.js';
export { classify } from './steps/classify.js';
export { transform } from './steps/transform.js';

// Utilities
export { ResultMerger } from './utils/merge.js';

// Types
export type {
  ResearchState,
  ResearchStep,
  PipelineConfig,
  ResearchInput,
} from './types/pipeline.js';

export type { ResearchPlan, PlanOptions } from './steps/plan.js';

export type { WebSearchOptions, SearchResult } from './steps/searchWeb.js';

export type { ExtractContentOptions, ExtractedContent } from './steps/extractContent.js';

export type { EvaluateOptions, RepeatUntilOptions } from './steps/flowControl.js';

export type { OrchestrateOptions } from './steps/orchestrate.js';

export type { FactCheckOptions, FactCheckResult } from './steps/factCheck.js';

export type { SummarizeOptions } from './steps/summarize.js';

export type { RefineQueryOptions, RefinedQuery } from './steps/refineQuery.js';

export type { AnalyzeOptions, AnalysisResult } from './steps/analyze.js';

export type { TrackOptions, TrackResult } from './steps/track.js';

export type { ParallelOptions } from './steps/parallel.js';

export type { ConflictResolutionOptions } from './utils/merge.js';

export type {
  ClassifyOptions,
  Entity,
  EntityCluster as Cluster,
  ClassificationData as ClassificationResult,
} from './steps/classify.js';
export type { TransformOptions } from './steps/transform.js';
