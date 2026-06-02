/** RDrive brand mark — a rounded gradient tile with a cloud + "R". Matches the favicon. */
export function Logo({ className = 'w-8 h-8' }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 64 64" role="img" aria-label="RDrive">
            <defs>
                <linearGradient id="rdriveLogoGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#2563eb" />
                    <stop offset="1" stopColor="#1d4ed8" />
                </linearGradient>
            </defs>
            {/* Rounded app-tile background */}
            <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#rdriveLogoGradient)" />
            {/* Cloud (centered) built from overlapping white shapes */}
            <g fill="#ffffff">
                <rect x="18" y="32" width="28" height="11" rx="5.5" />
                <circle cx="25" cy="33" r="7" />
                <circle cx="34" cy="28.5" r="9.5" />
                <circle cx="41" cy="33.5" r="6.5" />
            </g>
            {/* Stylized letter R, centered within the cloud */}
            <path
                transform="translate(-0.5,-9)"
                d="M26.4 49V33.5h7.2c3.2 0 5.4 2 5.4 5 0 2.2-1.2 3.9-3.2 4.6l3.7 5.9h-3.8l-3.2-5.3h-2.8V49h-3.3Zm3.3-8.1h3.5c1.5 0 2.5-.8 2.5-2.2s-1-2.2-2.5-2.2h-3.5v4.4Z"
                fill="#1d4ed8"
            />
        </svg>
    );
}
