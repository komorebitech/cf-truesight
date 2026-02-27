// zstd compression is not available in browsers without a WASM compressor.
// fzstd only provides decompression. For now, compression is disabled
// and the SDK sends plain JSON. The ingestion API accepts both.

export const isSupported = false;

export async function compress(_data: Uint8Array): Promise<Uint8Array> {
  throw new Error('zstd compression not available in browser');
}
