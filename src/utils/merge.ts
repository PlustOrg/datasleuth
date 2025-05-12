/**
 * Utilities for merging and resolving conflicts between research tracks
 */
import { TrackResult } from '../steps/track.js';
import { ResearchState } from '../types/pipeline.js';

/**
 * Options for conflict resolution
 */
export interface ConflictResolutionOptions {
  /** Strategy to use when resolving conflicts */
  strategy: 'first' | 'last' | 'mostConfident' | 'majority' | 'weighted' | 'custom';
  /** Weights to apply to different tracks (for weighted strategy) */
  weights?: Record<string, number>;
  /** Custom resolution function (for custom strategy) */
  customResolver?: (values: any[], metadata: any[]) => any;
  /** Function to extract confidence scores (for mostConfident strategy) */
  confidenceExtractor?: (trackResult: TrackResult) => number;
}

/**
 * Result merger utility to combine results from multiple research tracks
 */
export class ResultMerger {
  /**
   * Merges research data from multiple tracks
   *
   * @param tracks Track results to merge
   * @param options Conflict resolution options
   * @returns Merged data object
   */
  static mergeTrackData(
    tracks: Record<string, TrackResult>,
    options: ConflictResolutionOptions = { strategy: 'last' }
  ): Record<string, any> {
    const merged: Record<string, any> = {};
    const trackEntries = Object.entries(tracks);

    // Collect all unique data keys across all tracks
    const allKeys = new Set<string>();
    trackEntries.forEach(([_, track]) => {
      if (track.data) {
        Object.keys(track.data).forEach((key) => allKeys.add(key));
      }
    });

    // Resolve each key's value across tracks
    allKeys.forEach((key) => {
      // Skip the 'tracks' key as it's handled specially
      if (key === 'tracks') return;

      // Collect all values for this key across tracks
      const values: any[] = [];
      const metadata: any[] = [];

      trackEntries.forEach(([trackName, track]) => {
        if (track.data && key in track.data) {
          values.push(track.data[key]);
          metadata.push({
            trackName,
            confidence: track.metadata?.confidence || 0.5,
            timestamp: track.metadata?.completedAt,
          });
        }
      });

      // If we have values to merge, apply the resolution strategy
      if (values.length > 0) {
        merged[key] = ResultMerger.resolveConflict(values, metadata, options);
      }
    });

    return merged;
  }

  /**
   * Merges results from multiple tracks into a cohesive output
   *
   * @param tracks Track results to merge
   * @param state Current research state
   * @param options Conflict resolution options
   * @returns Merged results object
   */
  static mergeTrackResults(
    tracks: Record<string, TrackResult>,
    state: ResearchState,
    options: ConflictResolutionOptions = { strategy: 'mostConfident' }
  ): any {
    // Collect and categorize results from all tracks
    const resultsByType: Record<string, any[]> = {};
    const metadataByType: Record<string, any[]> = {};

    Object.entries(tracks).forEach(([trackName, track]) => {
      if (track.results && track.results.length > 0) {
        track.results.forEach((result) => {
          // Get result type (first key in the object)
          const type = Object.keys(result)[0];

          if (!resultsByType[type]) {
            resultsByType[type] = [];
            metadataByType[type] = [];
          }

          resultsByType[type].push(result[type]);
          metadataByType[type].push({
            trackName,
            confidence: track.metadata?.confidence || 0.5,
            timestamp: track.metadata?.completedAt,
          });
        });
      }
    });

    // Resolve conflicts for each result type
    const mergedResults: Record<string, any> = {};

    Object.keys(resultsByType).forEach((type) => {
      const values = resultsByType[type];
      const metadata = metadataByType[type];

      if (values.length === 1) {
        // No conflict, just use the single value
        mergedResults[type] = values[0];
      } else {
        // Resolve conflicts
        mergedResults[type] = ResultMerger.resolveConflict(values, metadata, options);
      }
    });

    return mergedResults;
  }

  /**
   * Resolves conflicts between multiple values using the specified strategy
   *
   * @param values Array of values to resolve
   * @param metadata Metadata for each value
   * @param options Conflict resolution options
   * @returns Resolved value
   */
  private static resolveConflict(
    values: any[],
    metadata: any[],
    options: ConflictResolutionOptions
  ): any {
    const { strategy, weights, customResolver, confidenceExtractor } = options;

    if (values.length === 0) return undefined;
    if (values.length === 1) return values[0];

    switch (strategy) {
      case 'first':
        return values[0];

      case 'last':
        return values[values.length - 1];

      case 'mostConfident':
        // Use the value with the highest confidence
        if (confidenceExtractor) {
          // Use custom confidence extractor
          const confidences = metadata.map((m, i) => ({
            value: values[i],
            confidence: confidenceExtractor(m),
          }));

          confidences.sort((a, b) => b.confidence - a.confidence);
          return confidences[0].value;
        } else {
          // Use confidence from metadata
          const withConfidence = metadata.map((m, i) => ({
            value: values[i],
            confidence: m.confidence || 0,
          }));

          withConfidence.sort((a, b) => b.confidence - a.confidence);
          return withConfidence[0].value;
        }

      case 'majority':
        // Use the most common value
        const counts = new Map<string, { count: number; value: any }>();

        values.forEach((value) => {
          const key = JSON.stringify(value);
          if (!counts.has(key)) {
            counts.set(key, { count: 0, value });
          }
          counts.get(key)!.count++;
        });

        let maxCount = 0;
        let maxValue;

        counts.forEach(({ count, value }) => {
          if (count > maxCount) {
            maxCount = count;
            maxValue = value;
          }
        });

        return maxValue;

      case 'weighted':
        // Apply weights to each track's value
        if (!weights) {
          throw new Error('Weights required for weighted conflict resolution strategy');
        }

        let weightedSum = 0;
        let totalWeight = 0;

        // Can only use weighted for numeric values
        if (typeof values[0] === 'number') {
          values.forEach((value, i) => {
            const trackName = metadata[i].trackName;
            const weight = weights[trackName] || 1;

            weightedSum += value * weight;
            totalWeight += weight;
          });

          return weightedSum / totalWeight;
        } else {
          // For non-numeric values, use the value with the highest weight
          let highestWeightValue;
          let highestWeight = -1;

          values.forEach((value, i) => {
            const trackName = metadata[i].trackName;
            const weight = weights[trackName] || 1;

            if (weight > highestWeight) {
              highestWeight = weight;
              highestWeightValue = value;
            }
          });

          return highestWeightValue;
        }

      case 'custom':
        // Use custom resolution function
        if (!customResolver) {
          throw new Error('Custom resolver required for custom conflict resolution strategy');
        }

        return customResolver(values, metadata);

      default:
        // Default to last value
        return values[values.length - 1];
    }
  }

  /**
   * Creates a merge function for use with parallel research
   *
   * @param options Conflict resolution options
   * @returns A merge function that can be used with the parallel step
   */
  static createMergeFunction(options: ConflictResolutionOptions = { strategy: 'mostConfident' }) {
    return function (tracks: Record<string, TrackResult>, state: ResearchState) {
      // Merge track data
      const mergedData = ResultMerger.mergeTrackData(tracks, options);

      // Merge track results
      const mergedResults = ResultMerger.mergeTrackResults(tracks, state, options);

      return {
        data: mergedData,
        results: mergedResults,
        metadata: {
          mergeStrategy: options.strategy,
          tracksCount: Object.keys(tracks).length,
          mergedAt: new Date().toISOString(),
        },
      };
    };
  }
}
