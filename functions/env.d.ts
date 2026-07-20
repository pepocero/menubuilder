interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  JWT_SECRET: string;
  STOCK_PROVIDER?: string;
  PIXABAY_API_KEY?: string;
  PEXELS_API_KEY?: string;
}

interface AuthContext {
  userId: string;
  email: string;
}

type PagesFunctionEnv = Env;

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    MEDIA: R2Bucket;
    JWT_SECRET: string;
    STOCK_PROVIDER?: string;
    PIXABAY_API_KEY?: string;
    PEXELS_API_KEY?: string;
  }
}
