declare module "api2d"

declare class Api2d {
  constructor(
    key?: null | string, 
    apiBaseUrl?: null | string,
    timeout?: number,
  );

  setApiBaseUrl(apiBaseUrl: string): void;

  setTimeout(timeout: number): void;

  abort(): void;

  completion(options: {
    onMessage?: (message: string) => void;
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

  vectorSave(
    text: string,
    embedding: number[], 
    uuid?: string, 
    meta?: string
  ): Promise<any>;

  vectorSearch(
    searchable_id: string,
    embedding: number[], // 1536维的向量
    topk?: number
  ): Promise<any>;

  vectorDelete(uuid: string): Promise<any>;
  vectorDeleteAll(): Promise<any>;
}

export default Api2d
