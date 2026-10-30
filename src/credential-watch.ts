import { stat } from 'node:fs/promises';
import { ProviderId } from './model';
// Watch only credential metadata. No credentials, URLs or OAuth codes are logged.
export class CredentialWatch {
  private previous = new Map<ProviderId, string>();
  constructor(private files: Partial<Record<ProviderId, string[]>>, private changed: (id: ProviderId, modifiedAt: number) => Promise<void>) {}
  async scan() {
    for (const [id, paths] of Object.entries(this.files) as [ProviderId, string[]][]) {
      const values = await Promise.all(paths.map(async file => { try { const s = await stat(file); return { signature:`${s.mtimeMs}:${s.size}`, modifiedAt:s.mtimeMs }; } catch { return { signature:'missing', modifiedAt:0 }; } }));
      const signature = values.map(value => value.signature).join('|');
      const before = this.previous.get(id); this.previous.set(id, signature);
      if (before !== undefined && before !== signature) await this.changed(id, Math.max(...values.map(value => value.modifiedAt)));
    }
  }
}
