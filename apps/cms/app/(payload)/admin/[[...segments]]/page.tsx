import config from "@payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";
import { importMap } from "../importMap.js";
type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[]>>;
};
export function generateMetadata({ params, searchParams }: Args) {
  return generatePageMetadata({ config, params, searchParams });
}
export default function Page({ params, searchParams }: Args) {
  return RootPage({ config, params, searchParams, importMap });
}
