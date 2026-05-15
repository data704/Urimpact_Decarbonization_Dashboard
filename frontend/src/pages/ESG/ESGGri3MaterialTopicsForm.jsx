import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
    ESG_GRI3_DRAFT_KEY,
    GRI3_MATERIAL_EMPTY,
    GRI3_MATERIAL_QUESTIONS,
} from './esgGri3MaterialTopicsConfig.js';

function draftStorageKey(organizationId) {
    return organizationId ? `${ESG_GRI3_DRAFT_KEY}_${organizationId}` : ESG_GRI3_DRAFT_KEY;
}

export default function ESGGri3MaterialTopicsForm({ onBack }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [form, setForm] = useState(GRI3_MATERIAL_EMPTY);
    const [savedToast, setSavedToast] = useState(false);

    const loadDraft = useCallback(() => {
        const key = draftStorageKey(user?.organizationId);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                setForm({ ...GRI3_MATERIAL_EMPTY(), ...JSON.parse(raw) });
            }
        } catch (_) {
            /* ignore */
        }
    }, [user?.organizationId]);

    useEffect(() => {
        loadDraft();
    }, [loadDraft]);

    const updateField = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
        setSavedToast(false);
    };

    const handleSave = () => {
        try {
            localStorage.setItem(draftStorageKey(user?.organizationId), JSON.stringify(form));
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 3000);
        } catch (_) {
            /* ignore */
        }
    };

    return (
        <div className="esg-gri2-detail">
            <div className="esg-gri2-toolbar">
                <button type="button" className="esg-back-link" onClick={onBack}>
                    <i className="fas fa-arrow-left" aria-hidden />
                    {t('esgModule.gri3.backToGeneral')}
                </button>
                {savedToast && (
                    <span className="esg-save-toast" role="status">
                        {t('esgModule.gri3.saved')}
                    </span>
                )}
                <button type="button" className="esg-btn esg-btn--primary" onClick={handleSave}>
                    {t('esgModule.gri3.save')}
                </button>
            </div>

            <div className="esg-gri2-intro">
                <div className="esg-egri">GRI 3</div>
                <h2 className="esg-gri2-heading">{t('esgModule.gri3.pageTitle')}</h2>
                <p className="esg-gri2-desc">{t('esgModule.gri3.pageDesc')}</p>
            </div>

            <section className="esg-gri2-section esg-gri3-questions">
                <ol className="esg-gri3-question-list">
                    {GRI3_MATERIAL_QUESTIONS.map((q, index) => {
                        const id = `esg-gri3-${q.name}`;
                        return (
                            <li key={q.name} className="esg-gri3-question-item">
                                <label className="esg-fg" htmlFor={id}>
                                    <span className="esg-fl esg-gri3-q-label">
                                        <span className="esg-gri3-q-num">{index + 1}.</span>
                                        {t(`esgModule.gri3.${q.labelKey}`)}
                                    </span>
                                    <textarea
                                        id={id}
                                        className="esg-fta"
                                        rows={4}
                                        value={form[q.name]}
                                        onChange={(e) => updateField(q.name, e.target.value)}
                                        placeholder={t('esgModule.gri3.answerPlaceholder')}
                                    />
                                </label>
                            </li>
                        );
                    })}
                </ol>
            </section>
        </div>
    );
}
