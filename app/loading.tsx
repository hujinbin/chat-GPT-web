import { ApiOutlined } from '@ant-design/icons';
import styles from './page.module.less';

export default function Loading() {
  return (
    <div className={styles.appLoading}>
      <div className={styles.loadingPanel}>
        <div className={styles.loadingLogo}>
          <ApiOutlined />
        </div>
        <div>
          <div className={styles.loadingTitle}>AI 聊天助手</div>
          <div className={styles.loadingText}>正在加载，请稍候...</div>
        </div>
        <div className={styles.loadingDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
