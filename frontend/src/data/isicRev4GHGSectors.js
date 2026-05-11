/**
 * Representative ISIC Rev.4-aligned hierarchy for Sector / Sub-sector (GHG Protocol style grouping).
 * Full UN ISIC hierarchy can replace this module data without UI changes.
 */
export const ISIC_SECTORS = [
    {
        code: 'A',
        label: 'A — Agriculture, forestry and fishing',
        subsectors: [
            { code: '01', label: '01 — Crop and animal production, hunting' },
            { code: '02', label: '02 — Forestry and logging' },
            { code: '03', label: '03 — Fishing and aquaculture' },
        ],
    },
    {
        code: 'B',
        label: 'B — Mining and quarrying',
        subsectors: [
            { code: '05', label: '05 — Mining of coal and lignite' },
            { code: '06', label: '06 — Extraction of crude petroleum and natural gas' },
            { code: '07', label: '07 — Mining of metal ores' },
            { code: '08', label: '08 — Other mining and quarrying' },
        ],
    },
    {
        code: 'C',
        label: 'C — Manufacturing',
        subsectors: [
            { code: '10', label: '10 — Manufacture of food products' },
            { code: '19', label: '19 — Manufacture of coke and refined petroleum' },
            { code: '20', label: '20 — Manufacture of chemicals' },
            { code: '24', label: '24 — Manufacture of basic metals' },
            { code: '29', label: '29 — Manufacture of motor vehicles' },
        ],
    },
    {
        code: 'D',
        label: 'D — Electricity, gas, steam and air conditioning supply',
        subsectors: [
            { code: '35', label: '35 — Electricity, gas, steam supply' },
        ],
    },
    {
        code: 'E',
        label: 'E — Water supply; sewerage, waste management',
        subsectors: [
            { code: '36', label: '36 — Water collection, treatment and supply' },
            { code: '37', label: '37 — Sewerage' },
            { code: '38', label: '38 — Waste collection and disposal' },
        ],
    },
    {
        code: 'F',
        label: 'F — Construction',
        subsectors: [
            { code: '41', label: '41 — Construction of buildings' },
            { code: '42', label: '42 — Civil engineering' },
        ],
    },
    {
        code: 'G',
        label: 'G — Wholesale and retail trade',
        subsectors: [
            { code: '46', label: '46 — Wholesale trade' },
            { code: '47', label: '47 — Retail trade' },
        ],
    },
    {
        code: 'H',
        label: 'H — Transportation and storage',
        subsectors: [
            { code: '49', label: '49 — Land transport' },
            { code: '51', label: '51 — Air transport' },
            { code: '52', label: '52 — Warehousing and support activities' },
        ],
    },
    {
        code: 'J',
        label: 'J — Information and communication',
        subsectors: [
            { code: '61', label: '61 — Telecommunications' },
            { code: '62', label: '62 — Computer programming and consultancy' },
            { code: '63', label: '63 — Information service activities' },
        ],
    },
    {
        code: 'K',
        label: 'K — Financial and insurance activities',
        subsectors: [
            { code: '64', label: '64 — Financial service activities' },
            { code: '65', label: '65 — Insurance and pension funding' },
        ],
    },
    {
        code: 'M',
        label: 'M — Professional, scientific and technical activities',
        subsectors: [
            { code: '70', label: '70 — Activities of head offices; management consultancy' },
            { code: '71', label: '71 — Architectural and engineering activities' },
        ],
    },
    {
        code: 'N',
        label: 'N — Administrative and support service activities',
        subsectors: [
            { code: '81', label: '81 — Services to buildings and landscape activities' },
        ],
    },
];

export const REVENUE_CURRENCIES = ['AED', 'INR', 'EUR', 'USD', 'GBP', 'SAR'];

/** Dial codes for primary phone — UAE listed first as typical default; remainder A–Z */
export const PHONE_COUNTRY_CODES = [
    { code: '+971', label: 'UAE (+971)' },
    { code: '+61', label: 'Australia (+61)' },
    { code: '+973', label: 'Bahrain (+973)' },
    { code: '+880', label: 'Bangladesh (+880)' },
    { code: '+86', label: 'China (+86)' },
    { code: '+20', label: 'Egypt (+20)' },
    { code: '+33', label: 'France (+33)' },
    { code: '+49', label: 'Germany (+49)' },
    { code: '+91', label: 'India (+91)' },
    { code: '+962', label: 'Jordan (+962)' },
    { code: '+254', label: 'Kenya (+254)' },
    { code: '+965', label: 'Kuwait (+965)' },
    { code: '+961', label: 'Lebanon (+961)' },
    { code: '+60', label: 'Malaysia (+60)' },
    { code: '+31', label: 'Netherlands (+31)' },
    { code: '+234', label: 'Nigeria (+234)' },
    { code: '+968', label: 'Oman (+968)' },
    { code: '+92', label: 'Pakistan (+92)' },
    { code: '+63', label: 'Philippines (+63)' },
    { code: '+974', label: 'Qatar (+974)' },
    { code: '+966', label: 'Saudi Arabia (+966)' },
    { code: '+65', label: 'Singapore (+65)' },
    { code: '+27', label: 'South Africa (+27)' },
    { code: '+90', label: 'Turkey (+90)' },
    { code: '+44', label: 'United Kingdom (+44)' },
    { code: '+1', label: 'United States (+1)' },
];
