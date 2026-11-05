'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SearchSource } from '@/api';
import styles from '@/app/page.module.less';

export interface ProcessStep {
  stage: string;
  message: string;
  metadata?: Record<string, unknown>;
}

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copyState, setCopyState] = useState('复制代码');
  const code = React.isValidElement<{ children?: React.ReactNode }>(children)
    ? String(children.props.children ?? '') : String(children ?? '');
  return (
    <div className={styles.codeBlock}>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(code); setCopyState('已复制'); }
        catch { setCopyState('请手动选择复制'); }
      }}>{copyState}</button>
      <pre>{children}</pre>
    </div>
  );
}

export function AssistantContent({ content, loading }: { content: string; loading?: boolean }) {
  return (
    <div className={styles.markdown} data-testid="assistant-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        table: ({ children }) => <div className={styles.tableScroll}><table>{children}</table></div>,
        img: ({ alt, src }) => <a href={src} target="_blank" rel="noopener noreferrer">{alt || '查看图片'}</a>
      }}>{content}</ReactMarkdown>
      {loading && <span className={styles.typingCursor} aria-label="正在输出" />}
    </div>
  );
}

export function UserContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = content.length > 600 || content.split('\n').length > 10;
  return (
    <div className={styles.userContent}>
      <div className={collapsible && !expanded ? styles.collapsedMessage : undefined}>{content}</div>
      {collapsible && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '收起消息' : '展开全部'}</button>}
    </div>
  );
}

export function ChatProgress({ steps = [], sources = [], loading, stopped, startedAt }: {
  steps?: ProcessStep[]; sources?: SearchSource[]; loading?: boolean; stopped?: boolean; startedAt: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [loading, startedAt]);
  if (!steps.length && !sources.length) return null;
  const latest = steps[steps.length - 1];
  const queries = new Set(steps.map(step => step.metadata?.query).filter(query => typeof query === 'string'));
  const summary = stopped ? '已停止生成' : loading ? latest?.message || '正在处理…'
    : latest?.stage === 'error' ? '处理失败，查看记录'
    : sources.length ? `${queries.size ? `检索 ${queries.size} 个关键词 · ` : ''}已参考 ${sources.length} 篇资料` : latest?.message || '处理记录';
  return (
    <details className={styles.processPanel} data-testid="chat-progress">
      <summary><span className={loading ? styles.liveIndicator : styles.doneIndicator} /><span aria-live="polite">{summary}</span>{loading && <span className={styles.processElapsed}>已用 {elapsed} 秒</span>}<span className={styles.processHint}>查看过程与来源</span></summary>
      <ol className={styles.processSteps}>
        {steps.map((step, index) => (
          <li key={`${step.stage}-${index}`}>
            <span>{step.message}</span>
            {typeof step.metadata?.query === 'string' && <small>检索词 · {step.metadata.query}</small>}
            {typeof step.metadata?.source_count === 'number' && <small>获取 {step.metadata.source_count} 条来源</small>}
            {typeof step.metadata?.read_count === 'number' && <small>已读取 {step.metadata.read_count} 篇正文</small>}
            {typeof step.metadata?.elapsed_ms === 'number' && <small>耗时 {(step.metadata.elapsed_ms / 1000).toFixed(1)} 秒</small>}
          </li>
        ))}
      </ol>
      {sources.length > 0 && <div className={styles.sourceList}>
        <strong>参考资料 · {sources.length}</strong>
        {sources.filter(source => /^https?:\/\//i.test(source.url)).map((source, index) => (
          <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noopener noreferrer">
            <span>{index + 1}. {source.title || source.url}</span>
            {source.snippet && <small>{source.snippet}</small>}
          </a>
        ))}
      </div>}
    </details>
  );
}
