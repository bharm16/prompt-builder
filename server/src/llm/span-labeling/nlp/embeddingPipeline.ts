import type { FeatureExtractionPipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const MODEL_DTYPE = 'fp32' as const;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

export async function loadEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = import('@huggingface/transformers').then(({ pipeline }) => {
      const createEmbeddingPipeline = pipeline as unknown as (
        task: 'feature-extraction',
        model: string,
        options: { dtype: typeof MODEL_DTYPE }
      ) => Promise<FeatureExtractionPipeline>;

      return createEmbeddingPipeline('feature-extraction', MODEL_ID, { dtype: MODEL_DTYPE });
    });
  }

  return pipelinePromise;
}
