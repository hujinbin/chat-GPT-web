import { ImageAttachment } from './attachments';

export type MediaKind = 'image' | 'video';
export interface MediaResult { kind: MediaKind; url: string }
export interface MediaOptions { images?: ImageAttachment[]; size?: string; ratio?: string; seconds?: string; videoMode?: 'text' | 'reference' | 'keyframe' }

export function safeMediaURL(value: unknown, image = false): string {
  if (typeof value !== 'string') return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (image && /^data:image\/(png|jpeg|webp);base64,/i.test(value)) return value;
  return '';
}

export async function mediaRequest(base: string, path: string, body?: unknown, signal?: AbortSignal, headers?: Record<string, string>): Promise<any> {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal
  });
  const result = await response.json();
  if (!response.ok || result.code !== 200) throw new Error(result.msg || '生成请求失败');
  return result.data;
}

export async function pollVideo(base: string, id: string, signal?: AbortSignal, onProgress?: (text: string) => void, headers?: Record<string, string>): Promise<MediaResult> {
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const result = await mediaRequest(base, `/ai/videos?video_id=${encodeURIComponent(id)}`, undefined, signal, headers);
    const task = result.data || result;
    if (['failed', 'cancelled', 'canceled'].includes(task.status)) throw new Error(task.error?.message || '视频生成失败');
    if (task.status === 'completed') {
      const url = safeMediaURL(task.url || task.video_url);
      if (!url) throw new Error('视频任务完成但未返回有效地址');
      return { kind: 'video', url };
    }
    onProgress?.(`视频生成中 ${Number(task.progress) || 0}%`);
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('已停止查询', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 2000);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  throw new Error('视频仍在处理中，可继续查询已有任务');
}

export async function generateMedia(base: string, kind: MediaKind, prompt: string, model: string, signal?: AbortSignal, onTask?: (id: string) => void, onProgress?: (text: string) => void, headers?: Record<string, string>, options: MediaOptions = {}): Promise<MediaResult> {
  const images = await Promise.all((options.images || []).map(async image => {
    if (kind !== 'video' || !image.url.startsWith('data:')) return image.url;
    const data = new FormData();
    const blob = await (await fetch(image.url, { signal })).blob();
    data.append('file', blob, image.name);
    const response = await fetch(`${base}/ai/images/upload`, { method: 'POST', body: data, signal, headers });
    const upload = await response.json();
    if (!response.ok || upload.code !== 200) throw new Error(upload.msg || '参考图上传失败');
    const url = safeMediaURL(upload.data?.url);
    if (!url.startsWith('https://')) throw new Error('视频参考图需要公网 HTTPS 地址');
    return url;
  }));
  const payload = kind === 'image' ? { prompt, model, images, size: options.size || '1K', ratio: options.ratio || '1:1' }
    : { prompt, model, mode: options.videoMode || (images.length ? 'reference' : 'text'), seconds: options.seconds || '5', aspect_ratio: options.ratio || '16:9', size: '720P',
      ...(options.videoMode === 'keyframe' ? { first_frame: images[0], last_frame: images[1] } : { images }) };
  const result = await mediaRequest(base, kind === 'image' ? '/ai/images/generations' : '/ai/videos', payload, signal, headers);
  if (kind === 'image') {
    const item = result.data?.[0] || result;
    const url = safeMediaURL(item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''), true);
    if (!url) throw new Error('图片服务未返回有效图片');
    return { kind, url };
  }
  const task = result.data || result;
  const id = task.video_id;
  if (!id) throw new Error('视频服务未返回 video_id');
  onTask?.(String(id));
  return pollVideo(base, String(id), signal, onProgress, headers);
}
