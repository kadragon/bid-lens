export interface Env {
  DB: D1Database;
  OPEN_DATA_API_PROXY_URL: string;
  OPEN_DATA_X_API_KEY: string;
  /** 어드민 Basic Auth 비밀번호 (username 고정 "admin"). secret. */
  ADMIN_PASSWORD: string;
  LOG_LEVEL?: string;
}
