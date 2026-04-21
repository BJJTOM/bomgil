"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface SiteConfig {
  instagram_url: string;
  threads_url: string;
  youtube_url: string;
}

export function Footer() {
  const { data: config } = useQuery<SiteConfig>({
    queryKey: ["site-config"],
    queryFn: async () => (await api.get("/community/site-config/")).data,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <footer className="border-t border-border-light bg-[#FAFAFA] py-8">
      <div className="max-w-7xl mx-auto px-5">
        {/* Social icons */}
        <div className="flex justify-center gap-5 mb-6">
          {config?.instagram_url && (
            <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-text-tertiary hover:text-[#E4405F] transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
          )}
          {config?.threads_url && (
            <a href={config.threads_url} target="_blank" rel="noopener noreferrer" aria-label="Threads" className="text-text-tertiary hover:text-black transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.907 3.59 12c.025 3.088.718 5.49 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.2 1.876-.775 3.354-1.725 4.42-1.1 1.232-2.69 1.9-4.6 1.93h-.029c-1.6-.02-2.905-.58-3.878-1.663-.896-1-1.39-2.376-1.39-3.87 0-1.593.533-2.997 1.5-3.948.96-.943 2.277-1.455 3.81-1.482 1.46-.025 2.703.383 3.693 1.213.474.398.862.874 1.163 1.415.263-.222.496-.471.696-.747.524-.72.79-1.604.79-2.626 0-1.753-.73-3.2-2.107-4.183C15.32 2.597 13.84 2.12 12.14 2.1h-.01c-2.435.018-4.277.78-5.478 2.262-1.12 1.382-1.7 3.4-1.722 5.99v.013l-.001.012v.012c.022 2.59.6 4.606 1.722 5.99 1.2 1.482 3.043 2.244 5.478 2.263h.01c1.946-.016 3.357-.554 4.577-1.748 1.62-1.586 1.722-3.672 1.257-4.958-.42-.578-.965-.975-1.627-1.19-.06.626-.18 1.215-.362 1.762-.408 1.227-1.07 2.2-1.97 2.895-1.002.774-2.268 1.18-3.665 1.174h-.015c-1.119-.013-2.06-.384-2.8-1.103-.665-.647-1.031-1.54-1.031-2.512 0-1.05.39-1.913 1.128-2.502.684-.544 1.615-.84 2.694-.856 1.01-.014 1.867.255 2.549.8.364.29.66.643.888 1.054.088-.497.133-1.022.133-1.574 0-1.306-.357-2.37-1.063-3.163-.747-.838-1.862-1.282-3.22-1.282h-.032c-1.14.013-2.098.38-2.846 1.093-.72.687-1.1 1.66-1.1 2.813 0 1.103.36 2.064 1.042 2.784.724.765 1.753 1.172 2.976 1.178h.017c1.424-.018 2.535-.467 3.302-1.335.618-.7.996-1.654 1.127-2.84l.005-.049.002-.026z"/>
              </svg>
            </a>
          )}
          {config?.youtube_url && (
            <a href={config.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-text-tertiary hover:text-[#FF0000] transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
          )}
        </div>

        {/* Links */}
        <div className="flex justify-center gap-4 text-[12px] text-text-tertiary">
          <Link href="/privacy" className="hover:text-text-primary transition-colors">개인정보처리방침</Link>
          <span className="text-border-light">|</span>
          <Link href="/terms" className="hover:text-text-primary transition-colors">이용약관</Link>
          <span className="text-border-light">|</span>
          <Link href="/notices" className="hover:text-text-primary transition-colors">공지사항</Link>
        </div>

        {/* Copyright */}
        <p className="text-center text-[11px] text-text-tertiary/60 mt-4">
          &copy; {new Date().getFullYear()} Moru. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
