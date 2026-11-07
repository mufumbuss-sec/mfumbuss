export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL
    ? "https://mufumburms.vercel.app"
    : "http://localhost:3000");
