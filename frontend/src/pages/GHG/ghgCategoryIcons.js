/**
 * Custom SVG path icons from urimpact-platform-v2 (viewBox 0 0 32 32).
 * Each category slug maps to one or more path `d` strings (pipe-separated in HTML).
 */

export const GHG_CATEGORY_SVG_PATHS = {
    'stationary-combustion': [
        'M4 20H28V16H4Z',
        'M8 10V16',
        'M12 8V16',
        'M16 10V16',
        'M20 8V16',
        'M10 8Q11 5 10 2',
        'M14 6Q15 3 14 1',
        'M18 8Q19 5 18 2',
    ],
    'mobile-combustion': [
        'M2 16H22L24 22H0Z',
        'M22 16H28L30 22H22V16Z',
        'M5 23A2.5 2.5 0 1 0 10 23',
        'M19 23A2.5 2.5 0 1 0 24 23',
    ],
    'fugitive-emissions': [
        'M4 26H28V22H4Z',
        'M20 22V14H26V22',
        'M10 16Q12 12 10 8',
        'M14 8Q16 4 14 2',
        'M18 6Q20 2 18 0',
    ],
    'process-emissions': [
        'M8 28H24Q26 28 26 18Q26 10 16 10Q6 10 6 18Q6 28 8 28Z',
        'M16 10V6',
        'M10 8L16 6L22 8',
        'M10 20Q13 18 16 20Q19 22 22 20',
    ],
    'purchased-electricity': ['M19 3L10 18H17L13 29L24 12H17Z'],
    'purchased-steam': [
        'M8 22Q6 18 8 14Q10 10 16 10Q22 10 24 14Q26 18 24 22',
        'M10 22Q10 26 16 26Q22 26 22 22',
        'M11 8Q12 5 11 2',
        'M16 8Q17 5 16 2',
        'M21 8Q22 5 21 2',
    ],
    'purchased-heating': [
        'M4 20H28V26H4Z',
        'M8 20V14',
        'M13 20V14',
        'M18 20V14',
        'M23 20V14',
        'M14 14Q12 11 14 8Q15 6 14 4Q16 6 18 8Q20 11 18 14',
    ],
    'purchased-cooling': ['M16 5V27', 'M5 16H27', 'M8 8L24 24', 'M24 8L8 24'],
};

export function hasCustomCategoryIcon(slug) {
    return Boolean(GHG_CATEGORY_SVG_PATHS[slug]);
}
