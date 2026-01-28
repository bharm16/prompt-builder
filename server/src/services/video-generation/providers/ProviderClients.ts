import Replicate from 'replicate';
import OpenAI from 'openai';
import { LumaAI } from 'lumaai';
import { DEFAULT_KLING_BASE_URL } from './klingProvider';
import { DEFAULT_VEO_BASE_URL } from './veoProvider';
import type { VideoGenerationServiceOptions } from '../types';

type LogSink = { warn: (message: string, meta?: Record<string, unknown>) => void };

export interface ProviderClients {
  replicate: Replicate | null;
  openai: OpenAI | null;
  luma: LumaAI | null;
  klingApiKey: string | null;
  klingBaseUrl: string;
  geminiApiKey: string | null;
  geminiBaseUrl: string;
}

export function createProviderClients(
  options: VideoGenerationServiceOptions,
  log: LogSink
): ProviderClients {
  let replicate: Replicate | null = null;
  if (!options.apiToken) {
    log.warn('REPLICATE_API_TOKEN not provided, Replicate-based video generation will be disabled');
  } else {
    replicate = new Replicate({ auth: options.apiToken });
  }

  let openai: OpenAI | null = null;
  if (!options.openAIKey) {
    log.warn('OPENAI_API_KEY not provided, Sora video generation will be disabled');
  } else {
    openai = new OpenAI({ apiKey: options.openAIKey });
  }

  let luma: LumaAI | null = null;
  if (!options.lumaApiKey) {
    log.warn('LUMA_API_KEY or LUMAAI_API_KEY not provided, Luma video generation will be disabled');
  } else {
    luma = new LumaAI({ authToken: options.lumaApiKey });
  }

  let klingApiKey: string | null = null;
  if (!options.klingApiKey) {
    log.warn('KLING_API_KEY not provided, Kling video generation will be disabled');
  } else {
    klingApiKey = options.klingApiKey;
  }

  const klingBaseUrl = (options.klingBaseUrl || DEFAULT_KLING_BASE_URL).replace(/\/+$/, '');

  let geminiApiKey: string | null = null;
  if (!options.geminiApiKey) {
    log.warn('GEMINI_API_KEY not provided, Veo video generation will be disabled');
  } else {
    geminiApiKey = options.geminiApiKey;
  }

  const geminiBaseUrl = (options.geminiBaseUrl || DEFAULT_VEO_BASE_URL).replace(/\/+$/, '');

  return {
    replicate,
    openai,
    luma,
    klingApiKey,
    klingBaseUrl,
    geminiApiKey,
    geminiBaseUrl,
  };
}
