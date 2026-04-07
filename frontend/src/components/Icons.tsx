// Feather-style SVG icons matching mobile app
// Usage: <Icon.Heart size={18} className="text-red-500" />

interface IconProps {
  size?: number;
  className?: string;
  fill?: string;
}

const base = (size: number, className: string) => ({
  width: size, height: size, viewBox: "0 0 24 24",
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  className,
});

export const Icon = {
  Heart: ({ size = 20, className = "", fill }: IconProps) => (
    <svg {...base(size, className)} fill={fill || "none"}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
  ),
  MessageCircle: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
  ),
  Share: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
  ),
  Bookmark: ({ size = 20, className = "", fill }: IconProps) => (
    <svg {...base(size, className)} fill={fill || "none"}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
  ),
  User: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  BarChart: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>
  ),
  Map: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
  ),
  Download: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
  ),
  Lock: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
  ),
  Globe: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
  ),
  Bell: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
  ),
  FileText: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
  ),
  Shield: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
  ),
  Info: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
  ),
  Eye: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  Key: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
  ),
  Star: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
  ),
  Megaphone: ({ size = 20, className = "" }: IconProps) => (
    <svg {...base(size, className)}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
  ),
  ChevronRight: ({ size = 16, className = "" }: IconProps) => (
    <svg {...base(size, className)}><polyline points="9 18 15 12 9 6" /></svg>
  ),
};
