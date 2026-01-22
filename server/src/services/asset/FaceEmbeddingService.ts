import Replicate from 'replicate';

type ReplicateFace = {
  bbox: [number, number, number, number];
  embedding: number[];
  det_score?: number;
  landmark?: number[][] | number[];
};

export class FaceEmbeddingService {
  private readonly replicate: Replicate;

  constructor(replicateClient?: Replicate, apiToken?: string) {
    if (replicateClient) {
      this.replicate = replicateClient;
      return;
    }

    const token = apiToken || process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error(
        'Replicate provider is not configured. REPLICATE_API_TOKEN is required.'
      );
    }

    this.replicate = new Replicate({ auth: token });
  }

  async extractEmbedding(imageUrl: string): Promise<{
    embedding: number[];
    bbox: [number, number, number, number];
    confidence: number | null;
    landmarks?: number[][] | number[] | null;
  }> {
    try {
      const output = (await this.replicate.run(
        'lucataco/insightface:dd4eb613b88738c7efe5f1c3f8837f32a0e68e79e17da5e9683bfe5bc2f5ca05',
        {
          input: {
            image: imageUrl,
            det_size: 640,
          },
        }
      )) as ReplicateFace[] | null;

      if (!output || !Array.isArray(output) || output.length === 0) {
        throw new Error('No face detected in image');
      }

      const primaryFace = output.reduce<ReplicateFace | null>((largest, face) => {
        const area = (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]);
        const largestArea = largest
          ? (largest.bbox[2] - largest.bbox[0]) * (largest.bbox[3] - largest.bbox[1])
          : 0;
        return area > largestArea ? face : largest;
      }, null);

      if (!primaryFace?.embedding) {
        throw new Error('Could not extract face embedding');
      }

      return {
        embedding: primaryFace.embedding,
        bbox: primaryFace.bbox,
        confidence: primaryFace.det_score ?? null,
        landmarks: primaryFace.landmark ?? null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Face embedding extraction failed: ${errorMessage}`);
    }
  }

  computeSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i += 1) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  async validateSamePerson(
    imageUrls: string[],
    threshold = 0.6
  ): Promise<{ isValid: boolean; similarity?: number; mismatchedImages?: [number, number] }> {
    if (imageUrls.length < 2) {
      return { isValid: true };
    }

    const embeddings = await Promise.all(
      imageUrls.map((url) => this.extractEmbedding(url))
    );

    for (let i = 0; i < embeddings.length; i += 1) {
      for (let j = i + 1; j < embeddings.length; j += 1) {
        const similarity = this.computeSimilarity(
          embeddings[i].embedding,
          embeddings[j].embedding
        );
        if (similarity < threshold) {
          return {
            isValid: false,
            similarity,
            mismatchedImages: [i, j],
          };
        }
      }
    }

    return { isValid: true };
  }

  serializeEmbedding(embedding: number[]): string {
    const buffer = Buffer.from(new Float32Array(embedding).buffer);
    return buffer.toString('base64');
  }

  deserializeEmbedding(base64String: string): number[] {
    const buffer = Buffer.from(base64String, 'base64');
    const floatArray = new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
    );
    return Array.from(floatArray);
  }
}

export default FaceEmbeddingService;
