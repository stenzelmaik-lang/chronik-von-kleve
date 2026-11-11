declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CVK_ENGAGEMENT_ENABLED?: string;
    CVK_ENGAGEMENT_AWARDS_ENABLED?: string;
    BUCKET?: R2Bucket;
  }
}
