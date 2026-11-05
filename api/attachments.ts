export const MAX_IMAGE_COUNT = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_TOTAL_BYTES = 20 * 1024 * 1024;

export interface ImageAttachment { id: string; name: string; url: string }
export type ContentBlock = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type ChatContent = string | ContentBlock[];
export interface ChatHistoryMessage { role: string; content: ChatContent }

export function chatContent(text: string, images: ImageAttachment[] = []): ChatContent {
  if (!images.length) return text;
  return [{ type: 'text', text }, ...images.map(image => ({ type: 'image_url' as const, image_url: { url: image.url } }))];
}

export function imageBytes(image: ImageAttachment): number {
  return image.url.startsWith('data:') ? Math.floor((image.url.split(',')[1]?.replace(/=+$/, '').length || 0) * 3 / 4) : 0;
}

export async function readImage(file: File): Promise<ImageAttachment> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片');
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('单张图片需要大于 0 且不超过 5MB');
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败，请重新选择'));
    reader.readAsDataURL(file);
  });
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name || '粘贴的图片', url };
}
