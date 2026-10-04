"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
export const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready || !captchaSiteKey || !element.current || !window.turnstile)
      return;
    const api = window.turnstile;
    const id = api.render(element.current, {
      sitekey: captchaSiteKey,
      action: "auth",
      size: "flexible",
      callback: (token: string) => callback.current(token),
      "expired-callback": () => callback.current(""),
      "error-callback": () => {
        callback.current("");
        setFailed(true);
      },
    });
    return () => {
      api.remove(id);
      callback.current("");
    };
  }, [ready]);
  if (!captchaSiteKey) return null;
  return (
    <div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => setFailed(true)}
      />
      <div ref={element} />
      {failed && (
        <p role="alert">
          Güvenlik doğrulaması yüklenemedi. Bağlantınızı kontrol edip sayfayı
          yenileyin.
        </p>
      )}
    </div>
  );
}
