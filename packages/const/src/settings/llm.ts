import {
  DEFAULT_MINI_MODEL as _DEFAULT_MINI_MODEL,
  DEFAULT_MODEL as _DEFAULT_MODEL,
} from '@lobechat/business-const';

export const DEFAULT_MINI_MODEL =
  typeof process !== 'undefined' && process.env?.DEFAULT_MINI_MODEL
    ? process.env.DEFAULT_MINI_MODEL
    : _DEFAULT_MINI_MODEL;
export const DEFAULT_MODEL =
  typeof process !== 'undefined' && process.env?.DEFAULT_MODEL
    ? process.env.DEFAULT_MODEL
    : _DEFAULT_MODEL;

export const DEFAULT_EMBEDDING_MODEL =
  typeof process !== 'undefined' && process.env?.DEFAULT_EMBEDDING_MODEL
    ? process.env.DEFAULT_EMBEDDING_MODEL
    : 'text-embedding-3-small';

export const DEFAULT_RERANK_MODEL =
  typeof process !== 'undefined' && process.env?.DEFAULT_RERANK_MODEL
    ? process.env.DEFAULT_RERANK_MODEL
    : 'rerank-english-v3.0';
export const DEFAULT_RERANK_PROVIDER =
  typeof process !== 'undefined' && process.env?.DEFAULT_RERANK_PROVIDER
    ? process.env.DEFAULT_RERANK_PROVIDER
    : 'cohere';
export const DEFAULT_RERANK_QUERY_MODE =
  typeof process !== 'undefined' && process.env?.DEFAULT_RERANK_QUERY_MODE
    ? process.env.DEFAULT_RERANK_QUERY_MODE
    : 'full_text';
