import path from 'node:path'

const env = (k: string, d?: string) => process.env[k] ?? d

/** Everything the server reads from the environment, in one place. */
export const config = {
  port: Number(env('PORT', '8787')),
  /** Public base URL of this API, e.g. https://api.autointeriore.ge — used as OAuth issuer and MCP resource. */
  publicUrl: env('PUBLIC_URL', 'http://localhost:8787')!.replace(/\/$/, ''),
  /** Origin(s) of the website/admin that may call the API with cookies. Comma separated. */
  webOrigins: env('WEB_ORIGIN', 'http://localhost:5173')!.split(',').map((s) => s.trim()).filter(Boolean),
  /** Postgres connection string. Without it the server runs on embedded PGlite (dev, tests, demo). */
  databaseUrl: env('DATABASE_URL'),
  dataDir: env('DATA_DIR', path.resolve('data'))!,
  get mediaDir() { return env('MEDIA_DIR', path.join(this.dataDir, 'media'))! },
  adminEmail: env('ADMIN_EMAIL'),
  adminPassword: env('ADMIN_PASSWORD'),
  adminName: env('ADMIN_NAME', 'Owner')!,
  /** Seed the demo data set into an empty database. */
  seedDemo: env('SEED_DEMO', process.env.NODE_ENV === 'production' ? 'false' : 'true') === 'true',
  /** Secure cookies need https; off for local http. */
  secureCookies: env('SECURE_COOKIES', 'auto') === 'auto' ? env('PUBLIC_URL', '')!.startsWith('https://') : env('SECURE_COOKIES') === 'true',
  metricool: {
    token: env('METRICOOL_TOKEN'),
    userId: env('METRICOOL_USER_ID'),
    blogId: env('METRICOOL_BLOG_ID'),
  },
  smtpUrl: env('SMTP_URL'),
  mailFrom: env('MAIL_FROM', 'Auto Interiore <workshop@autointeriore.ge>')!,
  /** Admin UI base for links in approval messages, e.g. https://autointeriore.ge/#/admin */
  adminUrl: env('ADMIN_URL', `${env('WEB_ORIGIN', 'http://localhost:5173')!.split(',')[0].trim()}/#/admin`)!,
  timezone: 'Asia/Tbilisi',
}
export type Config = typeof config
