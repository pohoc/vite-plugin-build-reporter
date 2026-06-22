import type { AssetRecord } from "./types.ts";
import { brotliSize, detectAssetType, gzipSize, rawByteLength } from "./utils.ts";

/** Rollup/Rolldown bundle 中可被收集的产物形态（结构兼容，不依赖具体后端类型） */
export interface CollectableChunk {
  type: "chunk";
  code?: string;
}

export interface CollectableAsset {
  type: "asset";
  source?: string | Uint8Array;
}

export type Collectable = CollectableChunk | CollectableAsset;

export interface CollectAssetsOptions {
  gzip: boolean;
  brotli: boolean;
  /** 是否收集 .map 产物，默认 false */
  includeSourceMaps?: boolean;
}

/** 遍历 bundle 收集每个产物的类型、原始大小、gzip 与 brotli 大小 */
export function collectAssets(
  bundle: Record<string, Collectable>,
  options: CollectAssetsOptions,
): AssetRecord[] {
  const records: AssetRecord[] = [];
  for (const [fileName, entry] of Object.entries(bundle)) {
    if (!options.includeSourceMaps && /\.map$/i.test(fileName)) continue;
    const raw = getRaw(entry);
    if (raw === null) continue;
    const size = rawByteLength(raw);
    records.push({
      name: fileName,
      type: detectAssetType(fileName),
      size,
      gzip: options.gzip ? gzipSize(raw) : null,
      brotli: options.brotli ? brotliSize(raw) : null,
    });
  }
  return records;
}

function getRaw(entry: Collectable): string | Uint8Array | null {
  if (entry.type === "asset") {
    const source = entry.source;
    if (typeof source === "string" || source instanceof Uint8Array) return source;
    return null;
  }
  return entry.code ?? null;
}
