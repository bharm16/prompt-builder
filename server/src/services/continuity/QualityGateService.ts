import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { logger } from '@infrastructure/Logger';
import { FaceEmbeddingService } from '@services/asset/FaceEmbeddingService';
import type { StorageService } from '@services/storage/StorageService';
import { STORAGE_TYPES } from '@services/storage/config/storageConfig';
import type { QualityGateResult } from './types';

interface QualityGateOptions {
  userId: string;
  referenceImageUrl: string;
  generatedVideoUrl: string;
  characterReferenceUrl?: string;
  styleThreshold?: number;
  identityThreshold?: number;
}

export class QualityGateService {
  private readonly log = logger.child({ service: 'QualityGateService' });
  private readonly faceEmbedding: FaceEmbeddingService | null;

  constructor(
    faceEmbedding?: FaceEmbeddingService | null,
    private storage?: StorageService
  ) {
    this.faceEmbedding = faceEmbedding ?? null;
  }

  async evaluate(options: QualityGateOptions): Promise<QualityGateResult> {
    const { referenceImageUrl, generatedVideoUrl } = options;

    const frameBuffer = await this.extractMidFrame(generatedVideoUrl);
    const styleScore = await this.compareHistogram(referenceImageUrl, frameBuffer);

    let identityScore: number | undefined;
    if (options.characterReferenceUrl && this.faceEmbedding && this.storage) {
      try {
        const ref = await this.faceEmbedding.extractEmbedding(options.characterReferenceUrl);
        const stored = await this.storage.saveFromBuffer(
          options.userId,
          frameBuffer,
          STORAGE_TYPES.PREVIEW_IMAGE,
          'image/png',
          { source: 'quality-gate' }
        );
        const candidate = await this.faceEmbedding.extractEmbedding(stored.viewUrl);
        identityScore = this.faceEmbedding.computeSimilarity(ref.embedding, candidate.embedding);
      } catch (error) {
        this.log.warn('Identity similarity check failed', {
          error: (error as Error).message,
        });
      }
    }

    const styleThreshold = options.styleThreshold ?? 0.75;
    const identityThreshold = options.identityThreshold ?? 0.6;

    const passedStyle = styleScore !== undefined ? styleScore >= styleThreshold : true;
    const passedIdentity =
      identityScore !== undefined ? identityScore >= identityThreshold : true;

    const result: QualityGateResult = {
      passed: passedStyle && passedIdentity,
    };
    if (styleScore !== undefined) {
      result.styleScore = styleScore;
    }
    if (identityScore !== undefined) {
      result.identityScore = identityScore;
    }
    return result;
  }

  private async extractMidFrame(videoUrl: string): Promise<Buffer> {
    const duration = await this.getVideoDuration(videoUrl);
    const timestamp = duration > 0 ? duration / 2 : 0;
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'quality-'));
    const outputPath = join(tempDir, 'frame.png');

    const args = [
      '-y',
      '-ss', String(Math.max(0, timestamp)),
      '-i', videoUrl,
      '-frames:v', '1',
      '-f', 'image2',
      '-vcodec', 'png',
      outputPath,
    ];

    await this.exec('ffmpeg', args);
    const buffer = await fs.readFile(outputPath);
    await fs.rm(tempDir, { recursive: true, force: true });
    return buffer;
  }

  private async getVideoDuration(videoUrl: string): Promise<number> {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoUrl,
    ];

    const output = await this.execWithOutput('ffprobe', args);
    const duration = Number(output.trim());
    return Number.isFinite(duration) ? duration : 0;
  }

  private async compareHistogram(referenceImageUrl: string, frameBuffer: Buffer): Promise<number> {
    const referenceBuffer = await this.downloadImage(referenceImageUrl);

    const refHist = await this.computeHistogram(referenceBuffer);
    const frameHist = await this.computeHistogram(frameBuffer);

    return this.correlation(refHist, frameHist);
  }

  private async computeHistogram(buffer: Buffer): Promise<number[]> {
    const { data } = await sharp(buffer)
      .resize(256, 256, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bins = 32;
    const hist = new Array(bins * 3).fill(0);

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      hist[Math.floor((r / 256) * bins)] += 1;
      hist[bins + Math.floor((g / 256) * bins)] += 1;
      hist[2 * bins + Math.floor((b / 256) * bins)] += 1;
    }

    const norm = Math.sqrt(hist.reduce((sum, v) => sum + v * v, 0)) || 1;
    return hist.map((v) => v / norm);
  }

  private correlation(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
      sum += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return sum;
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image (${response.status})`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async exec(command: string, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${command} failed (${code}): ${stderr.slice(0, 400)}`));
        }
      });
    });
  }

  private async execWithOutput(command: string, args: string[]): Promise<string> {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`${command} failed (${code}): ${stderr.slice(0, 400)}`));
        }
      });
    });
  }

  // no-op: identity comparisons upload to storage for URL access
}
