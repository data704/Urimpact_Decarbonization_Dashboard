/** GHG Protocol–style category cards (slugs stable for routes). */

export const SCOPE1_CATEGORIES = [
    { slug: 'stationary-combustion', icon: 'fa-industry', demoTonnes: 1235 },
    { slug: 'mobile-combustion', icon: 'fa-truck', demoTonnes: 876 },
    { slug: 'process-emissions', icon: 'fa-flask', demoTonnes: 456 },
    { slug: 'fugitive-emissions', icon: 'fa-wind', demoTonnes: 345 },
];

export const SCOPE2_CATEGORIES = [
    { slug: 'purchased-electricity', icon: 'fa-bolt', demoTonnes: 1820 },
    { slug: 'purchased-steam', icon: 'fa-cloud', demoTonnes: 210 },
    { slug: 'purchased-heating', icon: 'fa-temperature-high', demoTonnes: 95 },
    { slug: 'purchased-cooling', icon: 'fa-snowflake', demoTonnes: 42 },
];

export const SCOPE3_UPSTREAM = [
    { slug: 'purchased-goods-services', icon: 'fa-cart-shopping', demoTonnes: 0 },
    { slug: 'capital-goods', icon: 'fa-building', demoTonnes: 0 },
    { slug: 'fuel-energy-related', icon: 'fa-gas-pump', demoTonnes: 0 },
    { slug: 'upstream-transport-distribution', icon: 'fa-route', demoTonnes: 0 },
    { slug: 'waste-operations', icon: 'fa-recycle', demoTonnes: 0 },
    { slug: 'business-travel', icon: 'fa-plane', demoTonnes: 0 },
    { slug: 'employee-commuting', icon: 'fa-car', demoTonnes: 0 },
    { slug: 'upstream-leased-assets', icon: 'fa-handshake', demoTonnes: 0 },
];

export const SCOPE3_DOWNSTREAM = [
    { slug: 'downstream-transport-distribution', icon: 'fa-truck-fast', demoTonnes: 0 },
    { slug: 'processing-sold-products', icon: 'fa-boxes-stacked', demoTonnes: 0 },
    { slug: 'use-sold-products', icon: 'fa-plug', demoTonnes: 0 },
    { slug: 'end-of-life-sold-products', icon: 'fa-trash', demoTonnes: 0 },
    { slug: 'downstream-leased-assets', icon: 'fa-file-contract', demoTonnes: 0 },
    { slug: 'franchises', icon: 'fa-shop', demoTonnes: 0 },
    { slug: 'investments', icon: 'fa-chart-line', demoTonnes: 0 },
];

export function categoriesForScope(scopeNum) {
    if (scopeNum === 1) return SCOPE1_CATEGORIES;
    if (scopeNum === 2) return SCOPE2_CATEGORIES;
    if (scopeNum === 3) return [...SCOPE3_UPSTREAM, ...SCOPE3_DOWNSTREAM];
    return [];
}

export function findCategory(scopeNum, slug) {
    const list = categoriesForScope(scopeNum);
    return list.find((c) => c.slug === slug) || null;
}

export function titleKeyForCategory(slug) {
    return `ghg.cats.${slug.replace(/-/g, '_')}`;
}
