import { ImageAttachment } from './attachments';

export type MediaKind = 'image' | 'video';
export interface MediaResult { kind: MediaKind; url: string }
export interface MediaOptions { images?: ImageAttachment[]; size?: string; ratio?: string; seconds?: string; videoMode?: 'text' | 'reference' | 'keyframe' }

const VIDEO_RETRY_DELAYS = [30, 60];
const MAX_VIDEO_RETRY_DELAY = 120;

class VideoQueueFullError extends Error {
  constructor(readonly retryAfter: number) {
    super(`视频生成队列已满，任务未提交。请 ${Math.max(VIDEO_RETRY_DELAYS[0], retryAfter)} 秒后重新发送。`);
  }
}

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
  if (body && path === '/ai/videos' && response.status === 503 && result?.error?.code === 'video_queue_full') {
    const retryAfter = result.retry_after;
    throw new VideoQueueFullError(typeof retryAfter === 'number' && Number.isFinite(retryAfter) ? Math.ceil(retryAfter) : 0);
  }
  if (!response.ok || result.code !== 200) throw new Error(result.msg || '生成请求失败');
  return result.data;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function submitVideo(base: string, payload: unknown, signal?: AbortSignal, onProgress?: (text: string) => void, headers?: Record<string, string>) {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await mediaRequest(base, '/ai/videos', payload, signal, headers);
    } catch (error) {
      const retryDelay = VIDEO_RETRY_DELAYS[attempt];
      if (!(error instanceof VideoQueueFullError) || !retryDelay || error.retryAfter > MAX_VIDEO_RETRY_DELAY) throw error;
      const seconds = Math.max(retryDelay, error.retryAfter);
      onProgress?.(`视频生成队列已满，${seconds} 秒后重试提交（${attempt + 1}/${VIDEO_RETRY_DELAYS.length}）`);
      await wait(seconds * 1000, signal);
      onProgress?.('正在重新提交视频任务…');
    }
  }
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
    await wait(2000, signal);
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
  const result = kind === 'image' ? await mediaRequest(base, '/ai/images/generations', payload, signal, headers)
    : await submitVideo(base, payload, signal, onProgress, headers);
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
