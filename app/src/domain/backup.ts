import { validateState } from './state.ts';
import type { AppState, Tool } from '../types/models';

export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ASSET_BYTES = 50 * 1024 * 1024;

export type BackupMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type BackupAsset = {
  base64: string;
  mimeType: BackupMimeType;
};

/** Versioned, self-contained representation used by manual export/restore. */
export type BackupEnvelope = {
  version: 1;
  kind: 'handback-backup';
  state: AppState;
  assets: Record<string, BackupAsset>;
};

export type ReadPhoto = (uri: string) => Promise<{ base64: string; mimeType: string }>;
export type WritePhoto = (assetId: string, asset: BackupAsset) => Promise<string>;

const BACKUP_VERSION = 1 as const;
const BACKUP_KIND = 'handback-backup' as const;
const ASSET_PREFIX = 'asset:';
const MAX_BACKUP_JSON_BYTES = 100 * 1024 * 1024;

/** Export state and copy each local photo into the portable asset map. */
export async function createBackup(state: AppState, readPhoto: ReadPhoto): Promise<string> {
  const checked = validateState(state);
  const assets: Record<string, BackupAsset> = Object.create(null) as Record<string, BackupAsset>;
  let totalBytes = 0;
  const tools: Tool[] = [];

  for (const tool of checked.tools) {
    if (tool.photoUri === undefined) {
      tools.push({ ...tool });
      continue;
    }
    if (!isExternalPhotoUri(tool.photoUri)) throw new Error('Tool photo is already a backup asset reference');
    const assetId = tool.id;
    if (!isAssetId(assetId)) throw new Error('Tool ID cannot be represented as a backup asset ID');

    const asset = normalizeAsset(await readPhoto(tool.photoUri), tool.id);
    totalBytes += byteLength(asset.base64);
    if (totalBytes > MAX_TOTAL_ASSET_BYTES) throw new Error('Photos are too large for a portable backup');

    if (Object.prototype.hasOwnProperty.call(assets, assetId)) throw new Error('Duplicate tool asset ID');
    assets[assetId] = asset;
    tools.push({ ...tool, photoUri: `${ASSET_PREFIX}${assetId}` });
  }

  const envelope: BackupEnvelope = {
    version: BACKUP_VERSION,
    kind: BACKUP_KIND,
    state: { ...checked, tools },
    assets,
  };
  const raw = JSON.stringify(envelope);
  if (byteLengthUtf8(raw) > MAX_BACKUP_JSON_BYTES) throw new Error('Backup is too large');
  return raw;
}

/** Parse and validate a backup before any local data is replaced. */
export function parseBackup(raw: string): BackupEnvelope {
  if (typeof raw !== 'string' || byteLengthUtf8(raw) > MAX_BACKUP_JSON_BYTES) {
    throw new TypeError('Backup is too large or invalid');
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TypeError('Backup is not valid JSON');
  }
  if (!isPlainObject(value) || !hasExactKeys(value, ['version', 'kind', 'state', 'assets'])) {
    throw new TypeError('Unsupported HandBack backup format');
  }
  if (value.version !== BACKUP_VERSION || value.kind !== BACKUP_KIND) {
    throw new TypeError('Unsupported HandBack backup version');
  }

  const state = validateState(value.state);
  const assetsValue = value.assets;
  if (!isPlainObject(assetsValue)) throw new TypeError('Backup assets are invalid');

  const references = new Set<string>();
  for (const tool of state.tools) {
    if (tool.photoUri === undefined) continue;
    const assetId = parseAssetReference(tool.photoUri);
    references.add(assetId);
  }

  const assets: Record<string, BackupAsset> = {};
  let totalBytes = 0;
  for (const [assetId, assetValue] of Object.entries(assetsValue)) {
    if (!isAssetId(assetId)) throw new TypeError('Backup contains an invalid asset ID');
    if (!references.has(assetId)) throw new TypeError('Backup contains an unreferenced asset');
    const asset = normalizeAsset(assetValue, assetId);
    totalBytes += byteLength(asset.base64);
    if (totalBytes > MAX_TOTAL_ASSET_BYTES) throw new TypeError('Backup photos are too large');
    assets[assetId] = asset;
  }
  for (const assetId of references) {
    if (!Object.prototype.hasOwnProperty.call(assets, assetId)) {
      throw new TypeError(`Backup is missing photo asset ${assetId}`);
    }
  }

  return {
    version: BACKUP_VERSION,
    kind: BACKUP_KIND,
    state: { ...state, tools: state.tools.map((tool) => ({ ...tool })) },
    assets,
  };
}

/**
 * Write all embedded photos first, then return a new materialized state. The
 * caller decides when to persist this state, so cancellation or a write error
 * leaves the current records untouched.
 */
export async function materializeBackup(
  raw: string | BackupEnvelope,
  writePhoto: WritePhoto,
): Promise<AppState> {
  const backup = parseBackup(typeof raw === 'string' ? raw : JSON.stringify(raw));
  const photoUris = new Map<string, string>();

  for (const [assetId, asset] of Object.entries(backup.assets)) {
    const uri = await writePhoto(assetId, asset);
    if (typeof uri !== 'string' || uri.length === 0 || !isExternalPhotoUri(uri)) {
      throw new Error(`Photo asset ${assetId} could not be materialized`);
    }
    photoUris.set(assetId, uri);
  }

  const tools = backup.state.tools.map((tool) => {
    if (tool.photoUri === undefined) return { ...tool };
    const assetId = parseAssetReference(tool.photoUri);
    const uri = photoUris.get(assetId);
    if (!uri) throw new Error(`Photo asset ${assetId} was not materialized`);
    return { ...tool, photoUri: uri };
  });
  return validateState({ ...backup.state, tools });
}

function normalizeAsset(value: unknown, assetId: string): BackupAsset {
  if (!isPlainObject(value) || !hasExactKeys(value, ['base64', 'mimeType'])) {
    throw new TypeError(`Photo asset ${assetId} is invalid`);
  }
  if (typeof value.base64 !== 'string' || typeof value.mimeType !== 'string') {
    throw new TypeError(`Photo asset ${assetId} is invalid`);
  }
  const mimeType = value.mimeType;
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') {
    throw new TypeError(`Photo asset ${assetId} uses an unsupported image format`);
  }

  const bytes = decodeBase64(value.base64, assetId);
  if (bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) {
    throw new TypeError(`Photo asset ${assetId} is too large or empty`);
  }
  if (!hasImageSignature(bytes, mimeType)) {
    throw new TypeError(`Photo asset ${assetId} does not match its image format`);
  }
  return { base64: value.base64, mimeType };
}

function decodeBase64(value: string, assetId: string): Uint8Array {
  // Validate in bounded, non-backtracking steps. A single giant repeated
  // regexp can overflow the JavaScript regexp stack for a large valid photo.
  const maxBase64Chars = Math.ceil(MAX_ASSET_BYTES / 3) * 4;
  if (value.length === 0 || value.length > maxBase64Chars || value.length % 4 !== 0) {
    throw new TypeError(`Photo asset ${assetId} is not valid base64`);
  }
  let padding = 0;
  if (value.endsWith('==')) padding = 2;
  else if (value.endsWith('=')) padding = 1;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    const characterCode = value.charCodeAt(index);
    const valid = (characterCode >= 65 && characterCode <= 90)
      || (characterCode >= 97 && characterCode <= 122)
      || (characterCode >= 48 && characterCode <= 57)
      || characterCode === 43
      || characterCode === 47;
    if (!valid) throw new TypeError(`Photo asset ${assetId} is not valid base64`);
  }
  if (padding > 0 && value.slice(contentLength).length !== padding) {
    throw new TypeError(`Photo asset ${assetId} is not valid base64`);
  }
  if (padding === 2 && contentLength % 4 !== 2) throw new TypeError(`Photo asset ${assetId} is not valid base64`);
  if (padding === 1 && contentLength % 4 !== 3) throw new TypeError(`Photo asset ${assetId} is not valid base64`);

  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const first = base64Value(value.charCodeAt(index));
    const second = base64Value(value.charCodeAt(index + 1));
    const third = value.charAt(index + 2) === '=' ? 0 : base64Value(value.charCodeAt(index + 2));
    const fourth = value.charAt(index + 3) === '=' ? 0 : base64Value(value.charCodeAt(index + 3));
    const number = (first << 18) | (second << 12) | (third << 6) | fourth;
    if (outputIndex < output.length) output[outputIndex++] = (number >> 16) & 0xff;
    if (outputIndex < output.length) output[outputIndex++] = (number >> 8) & 0xff;
    if (outputIndex < output.length) output[outputIndex++] = number & 0xff;
  }
  return output;
}

function base64Value(characterCode: number): number {
  if (characterCode >= 65 && characterCode <= 90) return characterCode - 65;
  if (characterCode >= 97 && characterCode <= 122) return characterCode - 97 + 26;
  if (characterCode >= 48 && characterCode <= 57) return characterCode - 48 + 52;
  if (characterCode === 43) return 62;
  if (characterCode === 47) return 63;
  throw new TypeError('Invalid base64 character');
}

function hasImageSignature(bytes: Uint8Array, mimeType: BackupMimeType): boolean {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  return bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
}

function parseAssetReference(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith(ASSET_PREFIX)) {
    throw new TypeError('Backup state contains an external photo URI');
  }
  const assetId = value.slice(ASSET_PREFIX.length);
  if (!isAssetId(assetId)) throw new TypeError('Backup state contains an invalid photo asset reference');
  return assetId;
}

function isExternalPhotoUri(value: string): boolean {
  return value.length > 0 && !value.startsWith(ASSET_PREFIX) && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isAssetId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,256}$/.test(value);
}

function byteLength(value: string): number {
  return value.length / 4 * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
}

function byteLengthUtf8(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
