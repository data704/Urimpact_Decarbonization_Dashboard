/* ── Dummy data for the ROI & Scenario Analysis module ── */

export const industries = {
  fnb: {
    label: 'Food & Beverage',
    kpis: [
      { icon: 'leaf', cls: 'teal', label: 'Baseline Emissions', value: '250,000', sub: 'tCO\u2082e', trend: '\u2193 12% vs last year', trendCls: 'down' },
      { icon: 'target', cls: 'green', label: 'Reduction Potential', value: '98,000', sub: 'tCO\u2082e \u00b7 39%', trend: '\u2191 Achievable', trendCls: 'up' },
      { icon: 'coins', cls: 'amber', label: 'Total CAPEX', value: 'SAR 120M', sub: 'Investment', trend: '\u2014 Planned', trendCls: 'neutral' },
      { icon: 'trendUp', cls: 'teal', label: 'Annual Savings', value: 'SAR 34M', sub: 'Per Year', trend: '\u2191 8% YoY', trendCls: 'up' },
      { icon: 'bank', cls: 'blue', label: 'NPV', value: 'SAR 188M', sub: 'Net Present Value', trend: '\u2191 Strong', trendCls: 'up' },
      { icon: 'chart', cls: 'green', label: 'IRR', value: '24%', sub: 'Internal Rate', trend: '\u2191 Above hurdle', trendCls: 'up' },
      { icon: 'clock', cls: 'amber', label: 'Payback', value: '3.5 Yrs', sub: 'Simple Payback', trend: '\u2193 Fast', trendCls: 'down' },
      { icon: 'shield', cls: 'red', label: 'Carbon Liability Avoided', value: 'SAR 19M', sub: 'Per Year', trend: '\u2191 Savings', trendCls: 'up' },
    ],
    interventions: [
      { name: 'Solar PV', capex: 'SAR 11M', savings: 'SAR 2.32M', payback: '7.1 yrs', score: 87 },
      { name: 'Chiller Optimization', capex: 'SAR 1.5M', savings: 'SAR 262K', payback: '5.7 yrs', score: 81 },
      { name: 'Route Optimization', capex: 'SAR 0.5M', savings: 'SAR 4.19M', payback: '8 months', score: 95 },
      { name: 'LED Retrofit', capex: 'SAR 0.8M', savings: 'SAR 147K', payback: '5.4 yrs', score: 78 },
    ],
    hotspots: [
      { pct: 32, name: 'HVAC Systems', cost: 'SAR 4.2M/year', tco2e: '80,000 tCO\u2082e', potential: '32,000 tCO\u2082e' },
      { pct: 21, name: 'Chillers', cost: 'SAR 2.8M/year', tco2e: '52,500 tCO\u2082e', potential: '21,000 tCO\u2082e' },
      { pct: 18, name: 'Compressed Air', cost: 'SAR 2.1M/year', tco2e: '45,000 tCO\u2082e', potential: '15,750 tCO\u2082e' },
      { pct: 12, name: 'Fleet & Transport', cost: 'SAR 1.5M/year', tco2e: '30,000 tCO\u2082e', potential: '18,000 tCO\u2082e' },
      { pct: 10, name: 'Packaging Line', cost: 'SAR 1.2M/year', tco2e: '25,000 tCO\u2082e', potential: '11,250 tCO\u2082e' },
    ],
    treemap: [
      { label: 'HVAC Systems', pct: 32, cost: 'SAR 4.2M annual cost', bg: 'teal' },
      { label: 'Chillers', pct: 21, cost: 'SAR 2.8M', bg: 'blue' },
      { label: 'Compressed Air', pct: 18, cost: 'SAR 2.1M', bg: 'green' },
      { label: 'Packaging', pct: 12, cost: 'SAR 1.4M', bg: 'amber' },
      { label: 'Others', pct: 17, cost: 'SAR 1.9M', bg: 'purple' },
    ],
    interventionCards: [
      { tag: 'Solar', name: 'Solar PV Installation', metrics: { 'Emission Reduction': '3,870 tCO\u2082e/yr', CAPEX: 'SAR 11M', 'Annual Savings': 'SAR 2.32M', Payback: '7.1 Years' }, score: 87 },
      { tag: 'HVAC', name: 'Chiller Optimization', metrics: { 'Energy Savings': '1,460 MWh/yr', CAPEX: 'SAR 1.5M', 'Annual Savings': 'SAR 262,800', Payback: '5.7 Years' }, score: 81 },
      { tag: 'Logistics', name: 'Route Optimization', metrics: { 'Fuel Savings': '1.2M litres/yr', CAPEX: 'SAR 0.5M', 'Annual Savings': 'SAR 4.19M', Payback: '8 Months' }, score: 95 },
      { tag: 'Lighting', name: 'LED Retrofit', metrics: { 'Energy Savings': '820 MWh/yr', CAPEX: 'SAR 0.8M', 'Annual Savings': 'SAR 147,600', Payback: '5.4 Years' }, score: 78 },
      { tag: 'Storage', name: 'Battery Energy Storage', metrics: { 'Peak Shaving': '1,800 kW', CAPEX: 'SAR 6.2M', 'Annual Savings': 'SAR 1.08M', Payback: '5.7 Years' }, score: 72 },
      { tag: 'Water', name: 'Pump Efficiency Upgrade', metrics: { 'Emission Reduction': '12,600 tCO\u2082e/yr', CAPEX: 'SAR 2.1M', 'Annual Savings': 'SAR 790,000', Payback: '2.7 Years' }, score: 90 },
    ],
  },
  desal: {
    label: 'Desalination',
    kpis: [
      { icon: 'leaf', cls: 'teal', label: 'Baseline Emissions', value: '189,000', sub: 'tCO\u2082e', trend: '\u2193 5% vs last year', trendCls: 'down' },
      { icon: 'target', cls: 'green', label: 'Reduction Potential', value: '71,000', sub: 'tCO\u2082e \u00b7 37.8%', trend: '\u2191 Achievable', trendCls: 'up' },
      { icon: 'coins', cls: 'amber', label: 'Total CAPEX', value: 'SAR 85M', sub: 'Investment', trend: '\u2014 Planned', trendCls: 'neutral' },
      { icon: 'trendUp', cls: 'teal', label: 'Annual Savings', value: 'SAR 28M', sub: 'Per Year', trend: '\u2191 6% YoY', trendCls: 'up' },
      { icon: 'bank', cls: 'blue', label: 'NPV', value: 'SAR 154M', sub: 'Net Present Value', trend: '\u2191 Strong', trendCls: 'up' },
      { icon: 'chart', cls: 'green', label: 'IRR', value: '37.8%', sub: 'Internal Rate', trend: '\u2191 Above hurdle', trendCls: 'up' },
      { icon: 'clock', cls: 'amber', label: 'Payback', value: '2.6 Yrs', sub: 'Simple Payback', trend: '\u2193 Fast', trendCls: 'down' },
      { icon: 'shield', cls: 'red', label: 'Carbon Liability Avoided', value: 'SAR 14M', sub: 'Per Year', trend: '\u2191 Savings', trendCls: 'up' },
    ],
    interventions: [
      { name: 'Pump Efficiency Upgrade', capex: 'SAR 2.1M', savings: 'SAR 790K', payback: '2.7 yrs', score: 90 },
      { name: 'Solar PV Array', capex: 'SAR 22M', savings: 'SAR 5.1M', payback: '4.3 yrs', score: 88 },
      { name: 'Energy Recovery Devices', capex: 'SAR 8M', savings: 'SAR 3.2M', payback: '2.5 yrs', score: 93 },
      { name: 'Variable Speed Drives', capex: 'SAR 1.8M', savings: 'SAR 620K', payback: '2.9 yrs', score: 85 },
    ],
    hotspots: [
      { pct: 38, name: 'High-Pressure Pumps', cost: 'SAR 6.1M/year', tco2e: '71,820 tCO\u2082e', potential: '28,728 tCO\u2082e' },
      { pct: 24, name: 'Membrane Systems', cost: 'SAR 3.8M/year', tco2e: '45,360 tCO\u2082e', potential: '15,876 tCO\u2082e' },
      { pct: 16, name: 'Intake & Pre-treatment', cost: 'SAR 2.5M/year', tco2e: '30,240 tCO\u2082e', potential: '10,584 tCO\u2082e' },
      { pct: 12, name: 'Post-treatment', cost: 'SAR 1.9M/year', tco2e: '22,680 tCO\u2082e', potential: '7,938 tCO\u2082e' },
      { pct: 10, name: 'Brine Discharge', cost: 'SAR 1.5M/year', tco2e: '18,900 tCO\u2082e', potential: '5,670 tCO\u2082e' },
    ],
    treemap: [
      { label: 'High-Pressure Pumps', pct: 38, cost: 'SAR 6.1M annual cost', bg: 'teal' },
      { label: 'Membrane Systems', pct: 24, cost: 'SAR 3.8M', bg: 'blue' },
      { label: 'Intake & Pre-treat', pct: 16, cost: 'SAR 2.5M', bg: 'green' },
      { label: 'Post-treatment', pct: 12, cost: 'SAR 1.9M', bg: 'amber' },
      { label: 'Brine Discharge', pct: 10, cost: 'SAR 1.5M', bg: 'purple' },
    ],
    interventionCards: [
      { tag: 'Pumps', name: 'Pump Efficiency Upgrade', metrics: { 'Emission Reduction': '12,600 tCO\u2082e/yr', CAPEX: 'SAR 2.1M', 'Annual Savings': 'SAR 790,000', Payback: '2.7 Years' }, score: 90 },
      { tag: 'Solar', name: 'Solar PV Array', metrics: { 'Emission Reduction': '5,200 tCO\u2082e/yr', CAPEX: 'SAR 22M', 'Annual Savings': 'SAR 5.1M', Payback: '4.3 Years' }, score: 88 },
      { tag: 'Recovery', name: 'Energy Recovery Devices', metrics: { 'Energy Savings': '4,200 MWh/yr', CAPEX: 'SAR 8M', 'Annual Savings': 'SAR 3.2M', Payback: '2.5 Years' }, score: 93 },
      { tag: 'Drives', name: 'Variable Speed Drives', metrics: { 'Energy Savings': '1,800 MWh/yr', CAPEX: 'SAR 1.8M', 'Annual Savings': 'SAR 620K', Payback: '2.9 Years' }, score: 85 },
    ],
  },
  cement: {
    label: 'Cement',
    kpis: [
      { icon: 'leaf', cls: 'teal', label: 'Baseline Emissions', value: '1,200,000', sub: 'tCO\u2082e', trend: '\u2193 3%', trendCls: 'down' },
      { icon: 'target', cls: 'green', label: 'Reduction Potential', value: '318,000', sub: 'tCO\u2082e \u00b7 26.5%', trend: '\u2191 Achievable', trendCls: 'up' },
      { icon: 'coins', cls: 'amber', label: 'Total CAPEX', value: 'SAR 340M', sub: 'Investment', trend: '\u2014 Planned', trendCls: 'neutral' },
      { icon: 'trendUp', cls: 'teal', label: 'Annual Savings', value: 'SAR 62M', sub: 'Per Year', trend: '\u2191 4% YoY', trendCls: 'up' },
      { icon: 'bank', cls: 'blue', label: 'NPV', value: 'SAR 420M', sub: 'Net Present Value', trend: '\u2191 Strong', trendCls: 'up' },
      { icon: 'chart', cls: 'green', label: 'IRR', value: '18%', sub: 'Internal Rate', trend: '\u2191 Good', trendCls: 'up' },
      { icon: 'clock', cls: 'amber', label: 'Payback', value: '0.8 Yrs', sub: 'Simple Payback', trend: '\u2193 Very Fast', trendCls: 'down' },
      { icon: 'shield', cls: 'red', label: 'Carbon Liability Avoided', value: 'SAR 31M', sub: 'Per Year', trend: '\u2191 High Value', trendCls: 'up' },
    ],
    interventions: [
      { name: 'Clinker Substitution', capex: 'SAR 12M', savings: 'SAR 48M', payback: '0.25 yrs', score: 98 },
      { name: 'Waste Heat Recovery', capex: 'SAR 45M', savings: 'SAR 18M', payback: '2.5 yrs', score: 92 },
      { name: 'Alternative Fuels', capex: 'SAR 8M', savings: 'SAR 9.4M', payback: '0.85 yrs', score: 94 },
      { name: 'Kiln Optimization', capex: 'SAR 5M', savings: 'SAR 4.2M', payback: '1.2 yrs', score: 89 },
    ],
    hotspots: [
      { pct: 42, name: 'Clinker Production', cost: 'SAR 18M/year', tco2e: '504,000 tCO\u2082e', potential: '176,400 tCO\u2082e' },
      { pct: 22, name: 'Kiln Fuel Combustion', cost: 'SAR 9.5M/year', tco2e: '264,000 tCO\u2082e', potential: '79,200 tCO\u2082e' },
      { pct: 15, name: 'Raw Material Prep', cost: 'SAR 6.2M/year', tco2e: '180,000 tCO\u2082e', potential: '36,000 tCO\u2082e' },
      { pct: 12, name: 'Cement Grinding', cost: 'SAR 5.1M/year', tco2e: '144,000 tCO\u2082e', potential: '28,800 tCO\u2082e' },
      { pct: 9, name: 'Transportation', cost: 'SAR 3.8M/year', tco2e: '108,000 tCO\u2082e', potential: '32,400 tCO\u2082e' },
    ],
    treemap: [
      { label: 'Clinker Production', pct: 42, cost: 'SAR 18M annual cost', bg: 'teal' },
      { label: 'Kiln Fuel', pct: 22, cost: 'SAR 9.5M', bg: 'blue' },
      { label: 'Raw Material Prep', pct: 15, cost: 'SAR 6.2M', bg: 'green' },
      { label: 'Cement Grinding', pct: 12, cost: 'SAR 5.1M', bg: 'amber' },
      { label: 'Transportation', pct: 9, cost: 'SAR 3.8M', bg: 'purple' },
    ],
    interventionCards: [
      { tag: 'Clinker', name: 'Clinker Substitution', metrics: { 'Emission Reduction': '176,400 tCO\u2082e/yr', CAPEX: 'SAR 12M', 'Annual Savings': 'SAR 48M', Payback: '3 Months' }, score: 98 },
      { tag: 'Heat', name: 'Waste Heat Recovery', metrics: { 'Energy Savings': '24,000 MWh/yr', CAPEX: 'SAR 45M', 'Annual Savings': 'SAR 18M', Payback: '2.5 Years' }, score: 92 },
      { tag: 'Fuel', name: 'Alternative Fuels', metrics: { 'Emission Reduction': '79,200 tCO\u2082e/yr', CAPEX: 'SAR 8M', 'Annual Savings': 'SAR 9.4M', Payback: '10 Months' }, score: 94 },
      { tag: 'Kiln', name: 'Kiln Optimization', metrics: { 'Energy Savings': '8,400 MWh/yr', CAPEX: 'SAR 5M', 'Annual Savings': 'SAR 4.2M', Payback: '1.2 Years' }, score: 89 },
    ],
  },
  retail: {
    label: 'Retail',
    kpis: [
      { icon: 'leaf', cls: 'teal', label: 'Baseline Emissions', value: '45,000', sub: 'tCO\u2082e', trend: '\u2193 7%', trendCls: 'down' },
      { icon: 'target', cls: 'green', label: 'Reduction Potential', value: '15,700', sub: 'tCO\u2082e \u00b7 34.9%', trend: '\u2191 Achievable', trendCls: 'up' },
      { icon: 'coins', cls: 'amber', label: 'Total CAPEX', value: 'SAR 28M', sub: 'Investment', trend: '\u2014 Planned', trendCls: 'neutral' },
      { icon: 'trendUp', cls: 'teal', label: 'Annual Savings', value: 'SAR 9M', sub: 'Per Year', trend: '\u2191 11% YoY', trendCls: 'up' },
      { icon: 'bank', cls: 'blue', label: 'NPV', value: 'SAR 54M', sub: 'Net Present Value', trend: '\u2191 Positive', trendCls: 'up' },
      { icon: 'chart', cls: 'green', label: 'IRR', value: '31%', sub: 'Internal Rate', trend: '\u2191 Excellent', trendCls: 'up' },
      { icon: 'clock', cls: 'amber', label: 'Payback', value: '3.1 Yrs', sub: 'Simple Payback', trend: '\u2193 Fast', trendCls: 'down' },
      { icon: 'shield', cls: 'red', label: 'Carbon Liability Avoided', value: 'SAR 4.5M', sub: 'Per Year', trend: '\u2191 Savings', trendCls: 'up' },
    ],
    interventions: [
      { name: 'Refrigeration Conversion', capex: 'SAR 6.2M', savings: 'SAR 2.8M', payback: '2.2 yrs', score: 91 },
      { name: 'Smart Lighting Control', capex: 'SAR 1.8M', savings: 'SAR 890K', payback: '2.0 yrs', score: 88 },
      { name: 'HVAC Zoning', capex: 'SAR 3.4M', savings: 'SAR 1.5M', payback: '2.3 yrs', score: 85 },
      { name: 'Renewable PPA', capex: 'SAR 0.5M', savings: 'SAR 2.1M', payback: '0.24 yrs', score: 96 },
    ],
    hotspots: [
      { pct: 35, name: 'Refrigeration', cost: 'SAR 3.2M/year', tco2e: '15,750 tCO\u2082e', potential: '6,300 tCO\u2082e' },
      { pct: 25, name: 'HVAC & Cooling', cost: 'SAR 2.3M/year', tco2e: '11,250 tCO\u2082e', potential: '4,500 tCO\u2082e' },
      { pct: 18, name: 'Lighting', cost: 'SAR 1.6M/year', tco2e: '8,100 tCO\u2082e', potential: '4,050 tCO\u2082e' },
      { pct: 12, name: 'Supply Chain Logistics', cost: 'SAR 1.1M/year', tco2e: '5,400 tCO\u2082e', potential: '2,700 tCO\u2082e' },
      { pct: 10, name: 'Packaging & Waste', cost: 'SAR 0.9M/year', tco2e: '4,500 tCO\u2082e', potential: '1,800 tCO\u2082e' },
    ],
    treemap: [
      { label: 'Refrigeration', pct: 35, cost: 'SAR 3.2M annual cost', bg: 'teal' },
      { label: 'HVAC & Cooling', pct: 25, cost: 'SAR 2.3M', bg: 'blue' },
      { label: 'Lighting', pct: 18, cost: 'SAR 1.6M', bg: 'green' },
      { label: 'Logistics', pct: 12, cost: 'SAR 1.1M', bg: 'amber' },
      { label: 'Packaging', pct: 10, cost: 'SAR 0.9M', bg: 'purple' },
    ],
    interventionCards: [
      { tag: 'Cooling', name: 'Refrigeration Conversion', metrics: { 'Emission Reduction': '6,300 tCO\u2082e/yr', CAPEX: 'SAR 6.2M', 'Annual Savings': 'SAR 2.8M', Payback: '2.2 Years' }, score: 91 },
      { tag: 'Lighting', name: 'Smart Lighting Control', metrics: { 'Energy Savings': '1,200 MWh/yr', CAPEX: 'SAR 1.8M', 'Annual Savings': 'SAR 890K', Payback: '2.0 Years' }, score: 88 },
      { tag: 'HVAC', name: 'HVAC Zoning', metrics: { 'Energy Savings': '2,100 MWh/yr', CAPEX: 'SAR 3.4M', 'Annual Savings': 'SAR 1.5M', Payback: '2.3 Years' }, score: 85 },
      { tag: 'Renewable', name: 'Renewable PPA', metrics: { 'Emission Reduction': '4,500 tCO\u2082e/yr', CAPEX: 'SAR 0.5M', 'Annual Savings': 'SAR 2.1M', Payback: '3 Months' }, score: 96 },
    ],
  },
  logistics: {
    label: 'Logistics',
    kpis: [
      { icon: 'leaf', cls: 'teal', label: 'Baseline Emissions', value: '78,000', sub: 'tCO\u2082e', trend: '\u2193 9%', trendCls: 'down' },
      { icon: 'target', cls: 'green', label: 'Reduction Potential', value: '34,500', sub: 'tCO\u2082e \u00b7 44.2%', trend: '\u2191 High Potential', trendCls: 'up' },
      { icon: 'coins', cls: 'amber', label: 'Total CAPEX', value: 'SAR 15M', sub: 'Investment', trend: '\u2014 Planned', trendCls: 'neutral' },
      { icon: 'trendUp', cls: 'teal', label: 'Annual Savings', value: 'SAR 22M', sub: 'Per Year', trend: '\u2191 15% YoY', trendCls: 'up' },
      { icon: 'bank', cls: 'blue', label: 'NPV', value: 'SAR 98M', sub: 'Net Present Value', trend: '\u2191 Excellent', trendCls: 'up' },
      { icon: 'chart', cls: 'green', label: 'IRR', value: '42%', sub: 'Internal Rate', trend: '\u2191 Outstanding', trendCls: 'up' },
      { icon: 'clock', cls: 'amber', label: 'Payback', value: '0.67 Yrs', sub: '8 Months', trend: '\u2193 Very Fast', trendCls: 'down' },
      { icon: 'shield', cls: 'red', label: 'Carbon Liability Avoided', value: 'SAR 7M', sub: 'Per Year', trend: '\u2191 Savings', trendCls: 'up' },
    ],
    interventions: [
      { name: 'Route Optimization AI', capex: 'SAR 0.5M', savings: 'SAR 4.19M', payback: '8 months', score: 97 },
      { name: 'Fleet Electrification', capex: 'SAR 8.5M', savings: 'SAR 6.2M', payback: '1.4 yrs', score: 93 },
      { name: 'Load Optimization', capex: 'SAR 0.8M', savings: 'SAR 2.1M', payback: '4.6 months', score: 96 },
      { name: 'Driver Eco-Training', capex: 'SAR 0.1M', savings: 'SAR 380K', payback: '3.2 months', score: 94 },
    ],
    hotspots: [
      { pct: 45, name: 'Fleet Fuel Consumption', cost: 'SAR 7.2M/year', tco2e: '35,100 tCO\u2082e', potential: '17,550 tCO\u2082e' },
      { pct: 20, name: 'Warehouse Energy', cost: 'SAR 3.2M/year', tco2e: '15,600 tCO\u2082e', potential: '6,240 tCO\u2082e' },
      { pct: 15, name: 'Cold Chain', cost: 'SAR 2.4M/year', tco2e: '11,700 tCO\u2082e', potential: '4,680 tCO\u2082e' },
      { pct: 12, name: 'Last-Mile Delivery', cost: 'SAR 1.9M/year', tco2e: '9,360 tCO\u2082e', potential: '4,680 tCO\u2082e' },
      { pct: 8, name: 'Packaging & Waste', cost: 'SAR 1.3M/year', tco2e: '6,240 tCO\u2082e', potential: '1,872 tCO\u2082e' },
    ],
    treemap: [
      { label: 'Fleet Fuel', pct: 45, cost: 'SAR 7.2M annual cost', bg: 'teal' },
      { label: 'Warehouse Energy', pct: 20, cost: 'SAR 3.2M', bg: 'blue' },
      { label: 'Cold Chain', pct: 15, cost: 'SAR 2.4M', bg: 'green' },
      { label: 'Last-Mile', pct: 12, cost: 'SAR 1.9M', bg: 'amber' },
      { label: 'Packaging', pct: 8, cost: 'SAR 1.3M', bg: 'purple' },
    ],
    interventionCards: [
      { tag: 'AI', name: 'Route Optimization AI', metrics: { 'Fuel Savings': '1.2M litres/yr', CAPEX: 'SAR 0.5M', 'Annual Savings': 'SAR 4.19M', Payback: '8 Months' }, score: 97 },
      { tag: 'EV', name: 'Fleet Electrification', metrics: { 'Emission Reduction': '17,550 tCO\u2082e/yr', CAPEX: 'SAR 8.5M', 'Annual Savings': 'SAR 6.2M', Payback: '1.4 Years' }, score: 93 },
      { tag: 'Ops', name: 'Load Optimization', metrics: { 'Fuel Savings': '0.5M litres/yr', CAPEX: 'SAR 0.8M', 'Annual Savings': 'SAR 2.1M', Payback: '4.6 Months' }, score: 96 },
      { tag: 'Training', name: 'Driver Eco-Training', metrics: { 'Fuel Savings': '120K litres/yr', CAPEX: 'SAR 0.1M', 'Annual Savings': 'SAR 380K', Payback: '3.2 Months' }, score: 94 },
    ],
  },
};

export const forecastData = {
  labels: ['2026', '2028', '2030', '2032', '2035', '2040', '2045', '2050'],
  bau: [250000, 262000, 278000, 290000, 310000, 335000, 358000, 375000],
  conservative: [250000, 238000, 220000, 205000, 188000, 165000, 142000, 118000],
  moderate: [250000, 225000, 195000, 168000, 138000, 98000, 62000, 35000],
  aggressive: [250000, 210000, 170000, 130000, 88000, 42000, 18000, 5000],
};

export const cashflowData = {
  labels: ['Y0', 'Y2', 'Y5', 'Y10', 'Y15', 'Y20', 'Y25'],
  capex: [-120, -15, -5, 0, 0, 0, 0],
  opex: [0, -4, -4, -4, -4, -4, -4],
  energySavings: [0, 18, 34, 34, 34, 34, 34],
  carbonBenefits: [0, 4, 8, 14, 19, 24, 28],
};

export const pathwayData = {
  labels: ['2026', '2028', '2030', '2032', '2035', '2040', '2045', '2050'],
  emissionLevel: [250000, 220000, 190000, 158000, 118000, 68000, 28000, 0],
  netZeroTarget: [250000, 218750, 187500, 156250, 109375, 62500, 31250, 0],
};

export const monteCarloDistribution = [2, 4, 8, 15, 22, 31, 42, 55, 64, 74, 88, 98, 104, 112, 118, 122, 115, 108, 96, 82, 66, 50, 36, 22, 12, 6, 3, 1];

export const financialKPIs = [
  { label: 'ROI', value: '38%', trend: 'Strong', trendCls: 'up' },
  { label: 'IRR', value: '24%', trend: '+2% YoY', trendCls: 'up' },
  { label: 'NPV', value: 'SAR 188M', trend: 'Positive', trendCls: 'up' },
  { label: 'Payback', value: '3.5 yrs', trend: 'Fast', trendCls: 'down' },
  { label: 'MAC', value: 'SAR 12', sub: '/tCO\u2082e' },
  { label: 'LCCR', value: '1.84', trend: 'Above 1', trendCls: 'up' },
];

export const sensitivityMatrix = {
  headers: ['-20%', '-10%', 'Base', '+10%', '+20%'],
  rows: [
    { label: 'Electricity', values: ['161M', '175M', '188M', '201M', '215M'], levels: ['low', 'mid', 'high', 'high', 'high'] },
    { label: 'Fuel', values: ['170M', '179M', '188M', '197M', '206M'], levels: ['low', 'mid', 'high', 'high', 'high'] },
    { label: 'Carbon Price', values: ['152M', '168M', '188M', '208M', '228M'], levels: ['low', 'low', 'mid', 'high', 'high'] },
    { label: 'Inflation', values: ['194M', '191M', '188M', '184M', '181M'], levels: ['high', 'high', 'high', 'mid', 'low'] },
  ],
};

export const roadmapMilestones = [
  { year: '2026', events: ['Route Opt.', 'LED Retrofit'] },
  { year: '2027', events: ['Solar PV', 'Chiller Opt.'] },
  { year: '2028', events: ['HVAC Upgrade'] },
  { year: '2030', events: ['Fleet EV', 'Battery Storage'] },
  { year: '2035', events: ['Supplier Trans.', 'Green Hydrogen'] },
  { year: '2040', events: ['Process Elec.'] },
  { year: '2050', events: ['Net Zero'], isTarget: true },
];

export const carbonPricingExposure = [
  { label: 'Current Carbon Cost', value: 'SAR 5M/yr', bg: 'teal' },
  { label: '2030 Exposure', value: 'SAR 12M/yr', bg: 'amber' },
  { label: '2040 Exposure', value: 'SAR 31M/yr', bg: 'red' },
  { label: 'Liability Avoided', value: 'SAR 19M/yr', bg: 'green' },
];
