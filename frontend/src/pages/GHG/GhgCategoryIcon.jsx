import { GHG_CATEGORY_SVG_PATHS } from './ghgCategoryIcons.js';

/**
 * Renders the platform v2 category icon (32×32 stroke SVG) when defined for the slug.
 */
export default function GhgCategoryIcon({ slug, className = '' }) {
    const paths = GHG_CATEGORY_SVG_PATHS[slug];
    if (!paths?.length) return null;

    return (
        <svg
            className={className}
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden
        >
            {paths.map((d) => (
                <path key={d} d={d} />
            ))}
        </svg>
    );
}
