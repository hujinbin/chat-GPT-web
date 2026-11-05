'use client';

import React, { useRef, useState } from 'react';
import { Button, Input, Popover } from 'antd';
import { PictureOutlined, LinkOutlined } from '@ant-design/icons';
import { ImageAttachment, MAX_IMAGE_COUNT } from '@/api/attachments';
import styles from '@/app/page.module.less';

export default function ImageComposer({ images, onFiles, onAddURL, onRemove, disabled, busy }: {
  images: ImageAttachment[]; onFiles: (files: File[]) => void; onAddURL: (url: string) => void;
  onRemove: (id: string) => void; disabled: boolean; busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setURL] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  return (
    <div className={styles.imageComposer}>
      {images.length > 0 && <div className={styles.attachmentList} aria-label="待发送图片">
        {images.map((image, index) => <div className={styles.attachmentCard} key={image.id}>
          {/* 原图直接用作附件预览，保留实际宽高。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={`附件 ${index + 1} · ${image.name}`} />
          <span title={image.name}>{index + 1}. {image.name}</span>
          <button type="button" disabled={disabled} aria-label={`移除图片 ${index + 1}`} onClick={() => onRemove(image.id)}>×</button>
        </div>)}
      </div>}
      <div className={styles.attachmentActions}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden aria-label="上传图片文件"
          onChange={event => { onFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
        <Button size="small" icon={<PictureOutlined />} disabled={disabled || busy || images.length >= MAX_IMAGE_COUNT} loading={busy} onClick={() => inputRef.current?.click()}>添加图片</Button>
        <Popover open={linkOpen} onOpenChange={setLinkOpen} trigger="click" content={<div className={styles.imageURLInput}>
          <Input aria-label="图片链接" placeholder="公开 HTTPS 图片链接" value={url} onChange={event => setURL(event.target.value)} onPressEnter={() => { if (url.trim()) { onAddURL(url.trim()); setURL(''); setLinkOpen(false); } }} />
          <Button type="primary" size="small" disabled={!url.trim()} onClick={() => { onAddURL(url.trim()); setURL(''); setLinkOpen(false); }}>添加链接</Button>
        </div>}>
          <Button size="small" icon={<LinkOutlined />} disabled={disabled || busy || images.length >= MAX_IMAGE_COUNT}>图片链接</Button>
        </Popover>
        <span className={styles.attachmentHint}>可粘贴或拖入图片 · 每张 ≤ 5MB · 最多 5 张</span>
      </div>
    </div>
  );
}
