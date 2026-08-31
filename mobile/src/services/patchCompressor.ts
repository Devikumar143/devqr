import pako from 'pako';
import { FixPatch } from '../types';

export class PatchCompressor {
  public static encodePatch(patch: FixPatch): string {
    try {
      const jsonStr = JSON.stringify(patch);
      const uint8 = new TextEncoder().encode(jsonStr);
      const compressed = pako.deflate(uint8, { level: 9 });
      
      let base64 = btoa(String.fromCharCode(...compressed));
      const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `devqr://patch/${base64url}`;
    } catch {
      return '';
    }
  }
}
