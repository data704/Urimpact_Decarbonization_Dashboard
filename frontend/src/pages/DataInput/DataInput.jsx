import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../../context/DataStoreContext';
import { uploadReceiptAndExtract, uploadReceiptsMultiple, processDocument, submitReceiptExtraction, submitReceiptBatch, submitManualEmission, getAuthToken } from '../../api/client.js';
import './DataInput.css';

// Upload limits (must match backend: MAX_FILE_SIZE, uploadMultiple.files)
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_COUNT = 10;
const MAX_FILE_SIZE_MB = 10;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const FUEL_ACTIVITY_TYPES = ['diesel', 'petrol', 'gasoline', 'natural_gas', 'natural-gas', 'lpg', 'biodiesel'];
const isFuelActivity = (activityType) =>
    FUEL_ACTIVITY_TYPES.some(f => String(activityType || '').toLowerCase().trim().includes(f));

function DataInput() {
    const navigate = useNavigate();
    const { addScope1Entry, addScope2Entry } = useDataStore();
    const [inputMethod, setInputMethod] = useState('upload');
    const [notification, setNotification] = useState(null);
    
    // Scope 1 entries state
    const [scope1Entries, setScope1Entries] = useState([{
        id: 1,
        date: '',
        fuelType: 'Diesel',
        combustionType: 'mobile',
        amount: '',
        unit: 'Liters',
        vehicleId: '',
        costAmount: '',
        currency: 'USD'
    }]);
    
    // Scope 2 entries state
    const [scope2Entries, setScope2Entries] = useState([{
        id: 1,
        date: '',
        electricity: '',
        unit: 'kWh',
        supplier: '',
        gridRegion: 'Saudi Arabia - National',
        costAmount: '',
        currency: 'USD'
    }]);

    const fuelTypes = ['Diesel', 'Gasoline/Petrol', 'Natural Gas', 'LPG', 'Biodiesel'];
    const fuelUnits = ['Liters', 'Gallons', 'kg', 'm³'];
    const gridRegions = ['Saudi Arabia - National', 'Saudi Arabia - Eastern', 'Saudi Arabia - Western', 'Saudi Arabia - Central'];
    const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SAR'];

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // Scope 1 handlers
    const addScope1Row = () => {
        setScope1Entries([...scope1Entries, {
            id: Date.now(),
            date: '',
            fuelType: 'Diesel',
            combustionType: 'mobile',
            amount: '',
            unit: 'Liters',
            vehicleId: '',
            costAmount: '',
            currency: 'USD'
        }]);
    };

    const removeScope1Row = (id) => {
        if (scope1Entries.length > 1) {
            setScope1Entries(scope1Entries.filter(entry => entry.id !== id));
        }
    };

    const updateScope1Entry = (id, field, value) => {
        setScope1Entries(scope1Entries.map(entry => 
            entry.id === id ? { ...entry, [field]: value } : entry
        ));
    };

    // Scope 2 handlers
    const addScope2Row = () => {
        setScope2Entries([...scope2Entries, {
            id: Date.now(),
            date: '',
            electricity: '',
            unit: 'kWh',
            supplier: '',
            gridRegion: 'Saudi Arabia - National',
            costAmount: '',
            currency: 'USD'
        }]);
    };

    const removeScope2Row = (id) => {
        if (scope2Entries.length > 1) {
            setScope2Entries(scope2Entries.filter(entry => entry.id !== id));
        }
    };

    const updateScope2Entry = (id, field, value) => {
        setScope2Entries(scope2Entries.map(entry => 
            entry.id === id ? { ...entry, [field]: value } : entry
        ));
    };

    // Map manual form values to emissions API (activityType, unit, category, region)
    const fuelTypeToActivity = (fuelType) => {
        const map = { 'Diesel': 'diesel', 'Gasoline/Petrol': 'gasoline', 'Natural Gas': 'natural_gas', 'LPG': 'lpg', 'Biodiesel': 'biodiesel' };
        return map[fuelType] || fuelType?.toLowerCase().replace(/\s+/g, '_') || 'diesel';
    };
    const fuelTypeToCategory = (fuelType) => (fuelType === 'Natural Gas' ? 'NATURAL_GAS' : 'FUEL_COMBUSTION');
    const manualUnitToApi = (unit) => {
        const map = { 'Liters': 'l', 'Gallons': 'gal', 'kg': 'kg', 'm³': 'm3' };
        return map[unit] || unit;
    };
    const gridRegionToRegion = (gridRegion) => {
        if (!gridRegion) return 'SA';
        const s = String(gridRegion).trim();
        if (s.startsWith('Saudi Arabia')) return 'SA';
        return s.replace(/\s*-\s*/g, '-').trim();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const scope1Valid = scope1Entries.filter(entry => entry.date && entry.amount);
        const scope2Valid = scope2Entries.filter(entry => entry.date && entry.electricity);
        if (scope1Valid.length === 0 && scope2Valid.length === 0) {
            showNotification('Please add at least one entry with date and amount (or electricity).', 'error');
            return;
        }

        const token = getAuthToken();
        if (!token) {
            showNotification('Log in to save manual entries (e.g. demo@urimpact.com / Demo123!).', 'error');
            return;
        }

        setSubmittingManual(true);
        try {
            const payloads = [];
            scope1Valid.forEach(entry => {
                payloads.push({
                    activityType: fuelTypeToActivity(entry.fuelType),
                    activityAmount: parseFloat(entry.amount),
                    activityUnit: manualUnitToApi(entry.unit),
                    scope: 'SCOPE_1',
                    category: fuelTypeToCategory(entry.fuelType),
                    region: 'AE',
                    billingPeriodStart: entry.date ? new Date(entry.date + 'T00:00:00.000Z').toISOString() : undefined,
                });
            });
            scope2Valid.forEach(entry => {
                payloads.push({
                    activityType: 'electricity',
                    activityAmount: parseFloat(entry.electricity),
                    activityUnit: entry.unit === 'MWh' ? 'MWh' : 'kWh',
                    scope: 'SCOPE_2',
                    category: 'ELECTRICITY',
                    region: gridRegionToRegion(entry.gridRegion),
                    billingPeriodStart: entry.date ? new Date(entry.date + 'T00:00:00.000Z').toISOString() : undefined,
                });
            });

            const results = await Promise.all(payloads.map(p => submitManualEmission(p)));
            const totalCo2e = results.reduce((sum, r) => sum + (r?.co2e ?? 0), 0);
            const count = results.length;

            scope1Valid.forEach(entry => addScope1Entry({ ...entry, amount: parseFloat(entry.amount) }));
            scope2Valid.forEach(entry => addScope2Entry({ ...entry, electricity: parseFloat(entry.electricity) }));

        setScope1Entries([{
            id: 1,
            date: '',
            fuelType: 'Diesel',
            combustionType: 'mobile',
            amount: '',
            unit: 'Liters',
            vehicleId: '',
            costAmount: '',
            currency: 'USD'
        }]);
        setScope2Entries([{
            id: 1,
            date: '',
            electricity: '',
            unit: 'kWh',
            supplier: '',
                gridRegion: 'Saudi Arabia - National',
            costAmount: '',
            currency: 'USD'
        }]);

            showNotification(`${count} emission(s) saved (${totalCo2e.toFixed(1)} kg CO₂e).`, 'success');
            navigate('/', { state: { fromSubmit: true, submitMessage: `${count} manual emission(s) saved`, count } });
        } catch (err) {
            showNotification(err?.message || 'Failed to save emissions', 'error');
        } finally {
            setSubmittingManual(false);
        }
    };

    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [pendingVerifications, setPendingVerifications] = useState([]);
    const now = new Date();
    const [expectedDocMonth, setExpectedDocMonth] = useState(now.getMonth() + 1); // 1-12
    const [expectedDocYear, setExpectedDocYear] = useState(now.getFullYear());
    const [submittingId, setSubmittingId] = useState(null);
    const [submittingBatchId, setSubmittingBatchId] = useState(null);
    const [submittingAll, setSubmittingAll] = useState(false);
    const [submittingManual, setSubmittingManual] = useState(false);

    const dateFromExtraction = (fields) =>
        fields?.billingPeriodStart || fields?.documentDate || fields?.billingPeriodEnd || '';

    /** True if extracted date (ISO or YYYY-MM-DD) is in the same month/year as expected */
    const extractedDateMatchesExpected = (extractedDateStr, expectedYear, expectedMonth) => {
        if (!extractedDateStr || !expectedYear || !expectedMonth) return true;
        const d = new Date(extractedDateStr);
        if (Number.isNaN(d.getTime())) return true;
        return d.getFullYear() === expectedYear && (d.getMonth() + 1) === expectedMonth;
    };

    const getExpectedDateString = () =>
        `${expectedDocYear}-${String(expectedDocMonth).padStart(2, '0')}-01`;

    const buildPendingItem = (documentId, fileName, fields, expectedDate) => {
        const extracted = dateFromExtraction(fields);
        const expectedYear = expectedDate ? parseInt(expectedDate.slice(0, 4), 10) : null;
        const expectedMonth = expectedDate ? parseInt(expectedDate.slice(5, 7), 10) : null;
        const dateMismatch = Boolean(extracted && expectedYear && expectedMonth && !extractedDateMatchesExpected(extracted, expectedYear, expectedMonth));
        return {
            documentId,
            fileName,
            product: fields?.product ?? '',
            supplier: fields?.supplier ?? fields?.provider ?? '',
            date: extracted || expectedDate || '',
            activityType: fields?.activityType ?? '',
            activityAmount: fields?.activityAmount ?? '',
            activityUnit: fields?.activityUnit ?? '',
            region: fields?.region ?? 'AE',
            scope: fields?.scope ?? '',
            category: fields?.category ?? '',
            billingPeriodStart: fields?.billingPeriodStart ?? '',
            billingPeriodEnd: fields?.billingPeriodEnd ?? '',
            dateMismatch,
        };
    };

    const handleFileUpload = async (e) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;

        const token = getAuthToken();
        if (!token) {
            showNotification('Log in with the backend (e.g. demo@urimpact.com / Demo123!) to extract receipt data with AI.', 'error');
            e.target.value = '';
            return;
        }

        const files = Array.from(fileList);

        if (files.length > MAX_FILES_COUNT) {
            showNotification(`Maximum ${MAX_FILES_COUNT} files per upload. Please select fewer files.`, 'error');
            e.target.value = '';
            return;
        }

        const oversized = files.filter(f => f.size > MAX_FILE_SIZE_BYTES);
        if (oversized.length) {
            const names = oversized.map(f => `"${f.name}" (${(f.size / 1024 / 1024).toFixed(1)} MB)`).join(', ');
            showNotification(`File size limit is ${MAX_FILE_SIZE_MB} MB per file. Too large: ${names}`, 'error');
            e.target.value = '';
            return;
        }

        setUploadingReceipt(true);

        try {
            if (files.length === 1) {
                showNotification(`Uploading "${files[0].name}" – URIMPACT AI is reading the receipt...`, 'info');
                const result = await uploadReceiptAndExtract(files[0]);
                const fileName = result?.fileName || files[0].name;
                const docId = result?.documentId;
                const expectedDate = getExpectedDateString();
                if (result?.multiple && Array.isArray(result?.extractedFields)) {
                    const newItems = result.extractedFields.map((fields) => buildPendingItem(docId, fileName, fields, expectedDate));
                    setPendingVerifications(prev => [...prev, ...newItems]);
                    if (newItems.some((i) => i.dateMismatch)) {
                        showNotification(`The date on the receipt doesn't match your selected expected month (${MONTHS[expectedDocMonth - 1]} ${expectedDocYear}). Please correct the date in the table below before submitting.`, 'warning');
                    } else {
                        showNotification(`${newItems.length} entries extracted. Verify and use "Submit all" to save.`, 'success');
                    }
                } else {
                    const fields = result?.extractedFields || {};
                    const item = buildPendingItem(docId, fileName, fields, expectedDate);
                    setPendingVerifications(prev => [...prev, item]);
                    if (item.dateMismatch) {
                        showNotification(`The date on the receipt doesn't match your selected expected month (${MONTHS[expectedDocMonth - 1]} ${expectedDocYear}). Please correct the date in the table below before submitting.`, 'warning');
                    } else {
                        showNotification('Verify the numbers below and press Submit to calculate emissions.', 'success');
                    }
                }
            } else {
                showNotification(`Uploading ${files.length} receipts...`, 'info');
                const documents = await uploadReceiptsMultiple(files);
                let totalEntries = 0;
                let hasDateMismatch = false;
                const expectedDate = getExpectedDateString();
                for (let i = 0; i < documents.length; i++) {
                    showNotification(`Extracting ${i + 1}/${documents.length}: ${documents[i].fileName}`, 'info');
                    const result = await processDocument(documents[i].id, documents[i].fileName);
                    const fileName = result?.fileName || documents[i].fileName;
                    const docId = result?.documentId;
                    if (result?.multiple && Array.isArray(result?.extractedFields)) {
                        const newItems = result.extractedFields.map((fields) => buildPendingItem(docId, fileName, fields, expectedDate));
                        if (newItems.some((it) => it.dateMismatch)) hasDateMismatch = true;
                        setPendingVerifications(prev => [...prev, ...newItems]);
                        totalEntries += newItems.length;
                    } else {
                        const fields = result?.extractedFields || {};
                        const item = buildPendingItem(docId, fileName, fields, expectedDate);
                        if (item.dateMismatch) hasDateMismatch = true;
                        setPendingVerifications(prev => [...prev, item]);
                        totalEntries += 1;
                    }
                }
                if (hasDateMismatch) {
                    showNotification(`The date on one or more receipts doesn't match your selected expected month (${MONTHS[expectedDocMonth - 1]} ${expectedDocYear}). Please correct the dates in the table below before submitting.`, 'warning');
                } else {
                    showNotification(totalEntries > documents.length ? `${totalEntries} entries extracted. Verify and Submit.` : `${documents.length} receipts extracted. Verify each and Submit.`, 'success');
                }
            }
        } catch (err) {
            const msg = err?.message || 'Upload or extraction failed';
            showNotification(msg.includes('401') ? 'Session expired. Please log in again.' : msg, 'error');
        } finally {
            setUploadingReceipt(false);
            e.target.value = '';
        }
    };

    const updatePendingField = (index, field, value) => {
        setPendingVerifications(prev =>
            prev.map((item, i) => {
                if (i !== index) return item;
                const next = { ...item, [field]: value };
                if (field === 'date' && value) {
                    next.dateMismatch = !extractedDateMatchesExpected(value, expectedDocYear, expectedDocMonth);
                }
                return next;
            })
        );
    };

    const handleSubmitVerification = async (index) => {
        const item = pendingVerifications[index];
        if (!item?.documentId) return;
        const amount = Number(item.activityAmount);
        if (!item.activityType || Number.isNaN(amount) || !item.activityUnit) {
            showNotification('Please fill in Activity type, Amount, and Unit.', 'error');
            return;
        }

        setSubmittingId(item.documentId);
        try {
            const dateToSend = item.date || item.billingPeriodStart || undefined;
            const result = await submitReceiptExtraction(item.documentId, {
                activityType: item.activityType,
                activityAmount: amount,
                activityUnit: item.activityUnit,
                region: item.region || 'AE',
                scope: item.scope || undefined,
                category: item.category || undefined,
                billingPeriodStart: dateToSend || undefined,
                billingPeriodEnd: item.billingPeriodEnd || undefined,
                documentDate: dateToSend || undefined,
            });
            showNotification(`Saved: ${result?.emission?.co2e?.toFixed(2) ?? '—'} kg CO2e. Taking you to Dashboard…`, 'success');
            setPendingVerifications(prev => prev.filter((_, i) => i !== index));
            navigate('/', { state: { fromSubmit: true, submitMessage: `${result?.emission?.co2e?.toFixed(2) ?? '—'} kg CO₂e saved`, count: 1 } });
        } catch (err) {
            showNotification(err?.message || 'Submit failed', 'error');
        } finally {
            setSubmittingId(null);
        }
    };

    const handleSubmitBatch = async (documentId) => {
        const indices = pendingVerifications
            .map((item, i) => ({ item, i }))
            .filter(({ item }) => item.documentId === documentId);
        if (indices.length === 0) return;
        const entries = indices.map(({ item }) => ({
            activityType: item.activityType,
            activityAmount: Number(item.activityAmount),
            activityUnit: item.activityUnit,
            region: item.region || 'AE',
            scope: item.scope || undefined,
            category: item.category || undefined,
            documentDate: item.date || item.billingPeriodStart || undefined,
            billingPeriodStart: item.billingPeriodStart || undefined,
            billingPeriodEnd: item.billingPeriodEnd || undefined,
        }));
        const invalid = entries.find(e => !e.activityType || Number.isNaN(e.activityAmount) || !e.activityUnit);
        if (invalid) {
            showNotification('Please fill in Activity type, Amount, and Unit for all entries.', 'error');
            return;
        }
        setSubmittingBatchId(documentId);
        try {
            const result = await submitReceiptBatch(documentId, entries);
            const count = result?.emissions?.length ?? entries.length;
            const skipped = result?.skipped?.length ?? 0;
            const msg = skipped > 0
                ? `${count} emission(s) saved, ${skipped} row(s) skipped (invalid data). Taking you to Dashboard…`
                : `${count} emission(s) saved. Taking you to Dashboard…`;
            showNotification(msg, 'success');
            const removeIndices = new Set(indices.map(({ i }) => i));
            setPendingVerifications(prev => prev.filter((_, i) => !removeIndices.has(i)));
            navigate('/', { state: { fromSubmit: true, submitMessage: `${count} emission(s) saved`, count } });
        } catch (err) {
            showNotification(err?.message || 'Batch submit failed', 'error');
        } finally {
            setSubmittingBatchId(null);
        }
    };

    const clearPendingVerification = (index) => {
        setPendingVerifications(prev => prev.filter((_, i) => i !== index));
    };

    /**
     * Submit all pending receipts (all documents) at once.
     * Groups by documentId and calls submit (single) or submit-batch (multi) per document in parallel.
     */
    const handleSubmitAll = async () => {
        if (pendingVerifications.length === 0) return;

        const docIdsSeen = new Set();
        const groups = [];
        pendingVerifications.forEach((item) => {
            if (docIdsSeen.has(item.documentId)) return;
            docIdsSeen.add(item.documentId);
            const indices = pendingVerifications.map((p, i) => i).filter(i => pendingVerifications[i].documentId === item.documentId);
            groups.push({ documentId: item.documentId, indices });
        });

        const invalid = pendingVerifications.find(p => !p.activityType || Number.isNaN(Number(p.activityAmount)) || !p.activityUnit);
        if (invalid) {
            showNotification('Please fill in Activity type, Amount, and Unit for all entries before submitting all.', 'error');
            return;
        }

        setSubmittingAll(true);
        try {
            const promises = groups.map((group) => {
                const entries = group.indices.map((i) => {
                    const item = pendingVerifications[i];
                    const amount = Number(item.activityAmount);
                    const dateToSend = item.date || item.billingPeriodStart || undefined;
                    return {
                        activityType: item.activityType,
                        activityAmount: amount,
                        activityUnit: item.activityUnit,
                        region: item.region || 'AE',
                        scope: item.scope || undefined,
                        category: item.category || undefined,
                        documentDate: dateToSend || undefined,
                        billingPeriodStart: item.billingPeriodStart || undefined,
                        billingPeriodEnd: item.billingPeriodEnd || undefined,
                    };
                });
                if (entries.length === 1) {
                    return submitReceiptExtraction(group.documentId, {
                        activityType: entries[0].activityType,
                        activityAmount: entries[0].activityAmount,
                        activityUnit: entries[0].activityUnit,
                        region: entries[0].region,
                        scope: entries[0].scope,
                        category: entries[0].category,
                        billingPeriodStart: entries[0].billingPeriodStart,
                        billingPeriodEnd: entries[0].billingPeriodEnd,
                        documentDate: entries[0].documentDate,
                    }).then((result) => ({ count: 1, emissions: result?.emission ? [result.emission] : [] }));
                }
                return submitReceiptBatch(group.documentId, entries).then((result) => ({
                    count: result?.emissions?.length ?? entries.length,
                    emissions: result?.emissions ?? [],
                }));
            });

            const results = await Promise.all(promises);
            const totalCount = results.reduce((sum, r) => sum + r.count, 0);
            showNotification(`${totalCount} emission(s) saved. Taking you to Dashboard…`, 'success');
            setPendingVerifications([]);
            navigate('/', { state: { fromSubmit: true, submitMessage: `${totalCount} emission(s) saved`, count: totalCount } });
        } catch (err) {
            showNotification(err?.message || 'Submit all failed', 'error');
        } finally {
            setSubmittingAll(false);
        }
    };

    return (
        <div className="data-input-content">
            {/* Notification */}
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <i className={`fas fa-${notification.type === 'success' ? 'check-circle' : notification.type === 'error' ? 'exclamation-circle' : notification.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}`}></i>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Page Header */}
            <div className="page-header">
                <h1>Data Input</h1>
                <p>Enter your emission data manually or upload documents</p>
            </div>

            {/* Emission Data & Receipt Upload */}
            <>
            {/* Input Method Selection - Upload first, Manual second */}
            <div className="method-selection">
                <div 
                    className={`method-card ${inputMethod === 'upload' ? 'active' : ''}`}
                    onClick={() => setInputMethod('upload')}
                >
                    <div className="method-icon">
                        <i className="fas fa-file-upload"></i>
                    </div>
                    <h3>Upload Receipts</h3>
                    <p>Upload invoices or bills for automatic extraction</p>
                </div>
                <div 
                    className={`method-card ${inputMethod === 'manual' ? 'active' : ''}`}
                    onClick={() => setInputMethod('manual')}
                >
                    <div className="method-icon">
                        <i className="fas fa-keyboard"></i>
                    </div>
                    <h3>Manual Entry</h3>
                    <p>Enter emission data directly into forms</p>
                </div>
            </div>

            {inputMethod === 'manual' ? (
                <form onSubmit={handleSubmit}>
                    {/* Scope 1 Section */}
                    <div className="card data-section">
                        <div className="section-header">
                            <div className="section-title">
                                <span className="scope-badge scope1">Scope 1</span>
                                <h2>Direct Emissions</h2>
                            </div>
                            <button type="button" className="btn btn-add" onClick={addScope1Row}>
                                <i className="fas fa-plus"></i>
                                Add Entry
                            </button>
                        </div>

                        <div className="entries-container">
                            {scope1Entries.map((entry, index) => (
                                <div key={entry.id} className="entry-card">
                                    <div className="entry-header">
                                        <span className="entry-number">Entry {index + 1}</span>
                                        {scope1Entries.length > 1 && (
                                            <button 
                                                type="button" 
                                                className="btn-remove"
                                                onClick={() => removeScope1Row(entry.id)}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                    <div className="entry-grid">
                                        <div className="form-group">
                                            <label>Date</label>
                                            <input
                                                type="date"
                                                value={entry.date}
                                                onChange={(e) => updateScope1Entry(entry.id, 'date', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Combustion Type</label>
                                            <select
                                                value={entry.combustionType}
                                                onChange={(e) => updateScope1Entry(entry.id, 'combustionType', e.target.value)}
                                            >
                                                <option value="mobile">Mobile Combustion</option>
                                                <option value="stationary">Stationary Combustion</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Fuel Type</label>
                                            <select
                                                value={entry.fuelType}
                                                onChange={(e) => updateScope1Entry(entry.id, 'fuelType', e.target.value)}
                                            >
                                                {fuelTypes.map(fuel => (
                                                    <option key={fuel} value={fuel}>{fuel}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Amount</label>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={entry.amount}
                                                onChange={(e) => updateScope1Entry(entry.id, 'amount', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Unit</label>
                                            <select
                                                value={entry.unit}
                                                onChange={(e) => updateScope1Entry(entry.id, 'unit', e.target.value)}
                                            >
                                                {fuelUnits.map(unit => (
                                                    <option key={unit} value={unit}>{unit}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Vehicle ID (optional)</label>
                                            <input
                                                type="text"
                                                placeholder="VH-001"
                                                value={entry.vehicleId}
                                                onChange={(e) => updateScope1Entry(entry.id, 'vehicleId', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Cost Amount</label>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={entry.costAmount}
                                                onChange={(e) => updateScope1Entry(entry.id, 'costAmount', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Currency</label>
                                            <select
                                                value={entry.currency}
                                                onChange={(e) => updateScope1Entry(entry.id, 'currency', e.target.value)}
                                            >
                                                {currencies.map(curr => (
                                                    <option key={curr} value={curr}>{curr}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scope 2 Section */}
                    <div className="card data-section">
                        <div className="section-header">
                            <div className="section-title">
                                <span className="scope-badge scope2">Scope 2</span>
                                <h2>Indirect Emissions</h2>
                            </div>
                            <button type="button" className="btn btn-add" onClick={addScope2Row}>
                                <i className="fas fa-plus"></i>
                                Add Entry
                            </button>
                        </div>

                        <div className="entries-container">
                            {scope2Entries.map((entry, index) => (
                                <div key={entry.id} className="entry-card">
                                    <div className="entry-header">
                                        <span className="entry-number">Entry {index + 1}</span>
                                        {scope2Entries.length > 1 && (
                                            <button 
                                                type="button" 
                                                className="btn-remove"
                                                onClick={() => removeScope2Row(entry.id)}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                    <div className="entry-grid">
                                        <div className="form-group">
                                            <label>Date</label>
                                            <input
                                                type="date"
                                                value={entry.date}
                                                onChange={(e) => updateScope2Entry(entry.id, 'date', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Electricity Consumption</label>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={entry.electricity}
                                                onChange={(e) => updateScope2Entry(entry.id, 'electricity', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Unit</label>
                                            <select
                                                value={entry.unit}
                                                onChange={(e) => updateScope2Entry(entry.id, 'unit', e.target.value)}
                                            >
                                                <option value="kWh">kWh</option>
                                                <option value="MWh">MWh</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Grid Region</label>
                                            <select
                                                value={entry.gridRegion}
                                                onChange={(e) => updateScope2Entry(entry.id, 'gridRegion', e.target.value)}
                                            >
                                                {gridRegions.map(region => (
                                                    <option key={region} value={region}>{region}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Supplier</label>
                                            <input
                                                type="text"
                                                placeholder="Power Company Name"
                                                value={entry.supplier}
                                                onChange={(e) => updateScope2Entry(entry.id, 'supplier', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Cost Amount</label>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={entry.costAmount}
                                                onChange={(e) => updateScope2Entry(entry.id, 'costAmount', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Currency</label>
                                            <select
                                                value={entry.currency}
                                                onChange={(e) => updateScope2Entry(entry.id, 'currency', e.target.value)}
                                            >
                                                {currencies.map(curr => (
                                                    <option key={curr} value={curr}>{curr}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="submit-section">
                        <button type="submit" className="btn btn-primary btn-submit" disabled={submittingManual}>
                            {submittingManual ? <><i className="fas fa-spinner fa-spin"></i> Saving…</> : <><i className="fas fa-check"></i> Submit Data</>}
                        </button>
                        <p className="help-text" style={{ marginTop: '0.5rem' }}>Data is used to calculate emissions and is saved to your dashboard.</p>
                    </div>
                </form>
            ) : (
                <div className="card upload-section">
                    <div className="expected-doc-date">
                        <div className="expected-doc-date-header">
                            <i className="fas fa-calendar-alt"></i>
                            <span>Expected Document Date</span>
                        </div>
                        <p className="expected-doc-date-hint">Select the expected month and year of your receipt or utility bill. We&apos;ll verify this against the extracted date.</p>
                        <div className="expected-doc-date-fields">
                            <div className="form-group">
                                <label>Month *</label>
                                <select
                                    value={expectedDocMonth}
                                    onChange={(e) => setExpectedDocMonth(Number(e.target.value))}
                                >
                                    {MONTHS.map((m, i) => (
                                        <option key={m} value={i + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Year *</label>
                                <select
                                    value={expectedDocYear}
                                    onChange={(e) => setExpectedDocYear(Number(e.target.value))}
                                >
                                    {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className={`upload-area ${uploadingReceipt ? 'upload-area--loading' : ''}`}>
                        <div className="upload-icon">
                            <i className={`fas ${uploadingReceipt ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
                        </div>
                        <h3>{uploadingReceipt ? 'Reading receipt(s) with AI...' : 'Drag & Drop Receipts Here'}</h3>
                        <p>{uploadingReceipt ? 'URIMPACT AI is extracting numbers, then emissions are calculated and saved.' : 'or click to browse – you can select multiple files (PDF, Excel, JPEG, PNG). Max ' + MAX_FILE_SIZE_MB + ' MB per file, up to ' + MAX_FILES_COUNT + ' files.'}</p>
                        <input 
                            type="file" 
                            accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp"
                            multiple
                            onChange={handleFileUpload}
                            disabled={uploadingReceipt}
                        />
                    </div>
                    {pendingVerifications.length > 0 && (() => {
                        const docIdsSeen = new Set();
                        const groups = [];
                        pendingVerifications.forEach((item, index) => {
                            if (docIdsSeen.has(item.documentId)) return;
                            docIdsSeen.add(item.documentId);
                            const indices = pendingVerifications.map((p, i) => i).filter(i => pendingVerifications[i].documentId === item.documentId);
                            groups.push({ documentId: item.documentId, fileName: item.fileName, indices });
                        });
                        return (
                        <div className="upload-verify-list">
                            <div className="upload-verify-list-header">
                                <div>
                                    <h4><i className="fas fa-check-double"></i> Verify numbers from URIMPACT AI ({pendingVerifications.length} receipt{pendingVerifications.length !== 1 ? 's' : ''} / entries)</h4>
                                    <p className="upload-verify-hint">Edit if needed. Add the date if not extracted. Use &quot;Submit all&quot; below to send every receipt at once, or submit per file.</p>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-submit-all"
                                    onClick={handleSubmitAll}
                                    disabled={submittingAll || pendingVerifications.length === 0}
                                >
                                    {submittingAll ? <><i className="fas fa-spinner fa-spin"></i> Submitting all…</> : <><i className="fas fa-paper-plane"></i> Submit all</>}
                                </button>
                            </div>
                            {groups.map((group) => (
                                <div key={group.documentId} className={group.indices.length > 1 ? 'upload-verify-batch' : ''}>
                                    {group.indices.length > 1 && (
                                        <div className="upload-verify-batch-header">
                                            <span className="upload-verify-batch-title">{group.fileName} ({group.indices.length} entries)</span>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={() => handleSubmitBatch(group.documentId)}
                                                disabled={submittingBatchId === group.documentId}
                                            >
                                                {submittingBatchId === group.documentId ? <><i className="fas fa-spinner fa-spin"></i> Sending...</> : <><i className="fas fa-paper-plane"></i> Submit all {group.indices.length} entries</>}
                                            </button>
                                        </div>
                                    )}
                                    {group.indices.map((index) => {
                                        const item = pendingVerifications[index];
                                        return (
                                        <div key={`${item.documentId}-${index}`} className="upload-verify-card">
                                            <div className="upload-verify-card-title">{group.indices.length > 1 ? `${group.fileName} — row ${group.indices.indexOf(index) + 1}` : item.fileName}</div>
                                            <div className="upload-verify-fields">
                                                {isFuelActivity(item.activityType) && (
                                                    <div className="form-group">
                                                        <label>Product / Fuel name</label>
                                                        <input
                                                            type="text"
                                                            value={item.product}
                                                            onChange={(e) => updatePendingField(index, 'product', e.target.value)}
                                                            placeholder="e.g. Benzine 91, Super 98, Diesel"
                                                        />
                                                    </div>
                                                )}
                                                <div className={`form-group${item.dateMismatch ? ' form-group-date-mismatch' : ''}`}>
                                                    <label>Date</label>
                                                    <input
                                                        type="date"
                                                        value={item.date}
                                                        onChange={(e) => updatePendingField(index, 'date', e.target.value)}
                                                        placeholder="YYYY-MM-DD"
                                                    />
                                                    {item.dateMismatch ? (
                                                        <span className="help-text date-mismatch-warning">
                                                            <i className="fas fa-exclamation-triangle"></i> Doesn&apos;t match expected month ({MONTHS[expectedDocMonth - 1]} {expectedDocYear}). Correct the date above if needed.
                                                        </span>
                                                    ) : (
                                                        <span className="help-text">Add date if not extracted from receipt</span>
                                                    )}
                                                </div>
                                                <div className="form-group">
                                                    <label>Activity type *</label>
                                                    <input
                                                        type="text"
                                                        value={item.activityType}
                                                        onChange={(e) => updatePendingField(index, 'activityType', e.target.value)}
                                                        placeholder="e.g. electricity, diesel"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Amount *</label>
                                                    <input
                                                        type="number"
                                                        value={item.activityAmount}
                                                        onChange={(e) => updatePendingField(index, 'activityAmount', e.target.value)}
                                                        placeholder="0"
                                                        step="any"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Unit *</label>
                                                    <input
                                                        type="text"
                                                        value={item.activityUnit}
                                                        onChange={(e) => updatePendingField(index, 'activityUnit', e.target.value)}
                                                        placeholder="e.g. kWh, L"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Region (optional)</label>
                                                    <input
                                                        type="text"
                                                        value={item.region}
                                                        onChange={(e) => updatePendingField(index, 'region', e.target.value)}
                                                        placeholder="e.g. AE, AE-DU (extracted when on receipt)"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Supplier (optional)</label>
                                                    <input
                                                        type="text"
                                                        value={item.supplier ?? ''}
                                                        onChange={(e) => updatePendingField(index, 'supplier', e.target.value)}
                                                        placeholder="e.g. utility company, gas station (extracted when on receipt)"
                                                    />
                                                </div>
                                            </div>
                                            <div className="upload-verify-actions">
                                                <button type="button" className="btn btn-secondary" onClick={() => clearPendingVerification(index)}>
                                                    Cancel
                                                </button>
                                                {group.indices.length === 1 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary"
                                                        onClick={() => handleSubmitVerification(index)}
                                                        disabled={submittingId === item.documentId}
                                                    >
                                                        {submittingId === item.documentId ? <><i className="fas fa-spinner fa-spin"></i> Sending...</> : <><i className="fas fa-paper-plane"></i> Submit</>}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        );
                    })()}
                    <div className="upload-info">
                        <p><i className="fas fa-info-circle"></i> URIMPACT AI extracts numbers from the receipt; you verify, then Submit calculates emissions and saves</p>
                        <p><i className="fas fa-weight-hanging"></i> Upload limit: max {MAX_FILE_SIZE_MB} MB per file, up to {MAX_FILES_COUNT} files per batch</p>
                        <p><i className="fas fa-shield-alt"></i> Log in with the backend to use AI extraction (e.g. demo@urimpact.com)</p>
                    </div>
                </div>
            )}

            </>
        </div>
    );
}

export default DataInput;
