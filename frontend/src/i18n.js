import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';

const LANGUAGE_STORAGE_KEY = 'urimpact_language';
const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
const fallbackLng = savedLanguage === 'ar' ? 'ar' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: fallbackLng,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
  document.documentElement.dir = dir;
});

const initialDir = i18n.language === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = i18n.language;
document.documentElement.dir = initialDir;

export default i18n;
