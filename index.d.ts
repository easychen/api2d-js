declare class Api2d {
  constructor(
    key?: null | string, 
    apiBaseUrl?: null | string,
    timeout?: number,
  );

  setKey(key: string): void;

  setApiBaseUrl(apiBaseUrl: string): void;
  setApiVersion(apiVersion: number): void;

  setTimeout(timeout: number): void;

  abort(): void;

  completion(options: {
    onMessage?: (message: string) => void;
    onReasoning?: (message: string) => void;
    onEnd?: (message: string) => void;
    model?: string;
    stream?: boolean;
    noCache?: boolean;
    [key: string]: any;
  }): Promise<string> | Object;

  embeddings(options: {
      model?: string;
      [key: string]: any;
  }): Promise<any>;

  billing(): Promise<any>;

  vectorSave(options:{
    text: string,
    embedding: number[], 
    uuid?: string, 
    meta?: string
  }
  ): Promise<any>;

  vectorSearch(options:{
    searchable_id: string,
    embedding: number[], // 1536维的向量
    topk?: number
  }
  ): Promise<any>;

  vectorDelete(options:{
    uuid: string
  }): Promise<any>;
  vectorDeleteAll(): Promise<any>;

  textToSpeech(options: {
    text: string;
    voiceName: string;
    responseType: 'file' | 'stream';
    output: string | any;
  }): Promise<boolean> | Promise<void>;

  
  speechToText(options: {
    file: string;
    language: string;
    moderation?: boolean;
    moderation_stop?: boolean;
  }): Promise<string>;

  imageGenerate(options: ImageGenerateOptions): Promise<ImageGenerationResult>;
  imageGetOrder(requestId: string): Promise<ImageOrderResult>;
  azureSpeech(options: AzureSpeechOptions): Promise<AudioSpeechResult>;
  azureTranscribe(options: AzureTranscriptionOptions): Promise<AzureTranscriptionResult>;
  audioSpeech(options: AudioSpeechOptions): Promise<AudioSpeechResult>;
  audioTranscribe(options: AudioTranscriptionOptions): Promise<AudioTextResult>;
  audioTranslate(options: AudioTranslationOptions): Promise<AudioTextResult>;

}

export interface ImageGenerateOptions {
  prompt: string;
  model?: string;
  n?: number;
  size?: string;
  quality?: 'medium';
  output_format?: 'png' | 'jpeg' | 'webp';
  output_compression?: number;
  response_format?: 'url' | 'b64_json';
  background?: 'auto' | 'opaque' | 'transparent';
  moderation?: 'auto';
  /** Optional client request number. Supply a new value for each new request. */
  idempotencyKey?: string;
  imageModeration?: 'strict';
}

export interface ImageOrderResult {
  request_id: string;
  status: 'pending' | 'settled';
  data?: Array<{ url?: string; expires_at?: string; downloads_remaining?: number; b64_json?: string }>;
}

export interface ImageGenerationResult {
  request_id?: string;
  status?: 'pending' | 'settled';
  created?: number;
  data?: ImageOrderResult['data'];
  billing?: { total: number; model: number; audit: number; delivery: number; unconfirmed?: number };
  error?: { code?: string; message: string };
}

interface AudioOptions {
  /** Optional client request number. Supply a new value for each new request. */
  idempotencyKey?: string;
  moderation?: boolean;
  moderation_stop?: 'stop';
}

export interface AudioSpeechOptions extends AudioOptions {
  model?: string;
  input: string;
  voice: string;
  response_format?: 'mp3' | 'wav' | 'pcm' | 'opus' | 'aac' | 'flac';
  instructions?: string;
}

export interface AudioSpeechResult {
  audio: ArrayBuffer;
  contentType: string;
  requestId?: string;
  chargedPoints?: number;
}

interface AudioUploadOptions extends AudioOptions {
  /** Browser File or Blob, Node file path, or bytes in Node. */
  file: Blob | string | ArrayBuffer | ArrayBufferView;
  /** Required for nameless blobs and bytes. Include the audio extension. */
  filename?: string;
  stream?: boolean;
  response_format?: 'json' | 'text' | 'verbose_json' | 'srt' | 'vtt';
  onDelta?: (delta: string, text: string) => void;
}

export interface AudioTranscriptionOptions extends AudioUploadOptions {
  model?: string;
  language?: string;
  languages?: string[];
  keywords?: string[];
  prompt?: string;
}

export interface AudioTranslationOptions extends AudioUploadOptions {
  model?: string;
}

export interface AudioTextResult {
  text: string;
  type?: 'transcript.text.done' | 'translation.text.done';
  requestId?: string;
  chargedPoints?: number;
  usage?: Record<string, unknown>;
  languages?: Array<Record<string, unknown>>;
  moderation?: Record<string, unknown>;
}

export interface AzureSpeechOptions extends AudioOptions {
  text: string;
  voiceName: string;
  format?: 'mp3' | 'wav' | 'opus';
  speed?: number;
  style?: string;
}

export interface AzureTranscriptionOptions extends Pick<AudioUploadOptions, 'file' | 'filename' | 'idempotencyKey' | 'moderation' | 'moderation_stop'> {
  model?: 'short' | 'fast' | 'llm';
  language?: string;
  detail?: boolean;
  diarization?: boolean;
  maxSpeakers?: number;
  phraseList?: string[];
}

export interface AzureTranscriptionResult extends AudioTextResult {
  durationMilliseconds?: number;
  segments?: Array<{
    text: string;
    offsetMilliseconds: number;
    durationMilliseconds: number;
    speaker?: number;
    locale?: string;
    words?: Array<{ text: string; offsetMilliseconds: number; durationMilliseconds: number }>;
  }>;
}

export default Api2d
