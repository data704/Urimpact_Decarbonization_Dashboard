import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { ENV_DISCLOSURES, emptyEnvForm } from './esgEnvironmentConfig.js';

function draftStorageKey(baseKey, organizationId) {
    return organizationId ? `${baseKey}_${organizationId}` : baseKey;
}

export default function ESGEnvDisclosureForm({ formKey, onBack }) {
    const config = ENV_DISCLOSURES[formKey];
    const { t } = useTranslation();
    const { user } = useAuth();
    const [form, setForm] = useState(() => emptyEnvForm(config));
    const [savedToast, setSavedToast] = useState(false);

    const loadDraft = useCallback(() => {
        const key = draftStorageKey(config.draftKey, user?.organizationId);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                setForm({ ...emptyEnvForm(config), ...JSON.parse(raw) });
            }
        } catch (_) {
            /* ignore */
        }
    }, [config, user?.organizationId]);

    useEffect(() => {
        loadDraft();
    }, [loadDraft]);

    const updateField = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
        setSavedToast(false);
    };

    const handleSave = () => {
        try {
            localStorage.setItem(
                draftStorageKey(config.draftKey, user?.organizationId),
                JSON.stringify(form),
            );
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
                    {t('esgModule.env.backToEnvironment')}
                </button>
                {savedToast && (
                    <span className="esg-save-toast" role="status">
                        {t('esgModule.env.saved')}
                    </span>
                )}
                <button type="button" className="esg-btn esg-btn--primary" onClick={handleSave}>
                    {t('esgModule.env.save')}
                </button>
            </div>

            <div className="esg-gri2-intro">
                <div className="esg-egri" style={{ background: '#E8F8EE', color: '#27AE60' }}>
                    {config.griCode}
                </div>
                <h2 className="esg-gri2-heading">{t(`esgModule.env.${config.titleKey}`)}</h2>
                <p className="esg-gri2-desc">{t(`esgModule.env.${config.descKey}`)}</p>
            </div>

            {config.sections.map((section) => (
                <section key={section.titleKey} className="esg-gri2-section">
                    <h3 className="esg-gri2-section-title">{t(`esgModule.env.${section.titleKey}`)}</h3>
                    <div className="esg-gri2-fields">
                        {section.fields.map((field) => {
                            const id = `esg-env-${formKey}-${field.name}`;
                            return (
                                <label key={field.name} className="esg-fg" htmlFor={id}>
                                    <span className="esg-fl">{t(`esgModule.env.${field.labelKey}`)}</span>
                                    <textarea
                                        id={id}
                                        className="esg-fta"
                                        rows={4}
                                        value={form[field.name]}
                                        onChange={(e) => updateField(field.name, e.target.value)}
                                        placeholder={t('esgModule.env.answerPlaceholder')}
                                    />
                                </label>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
