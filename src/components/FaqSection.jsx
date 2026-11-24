import { useState } from 'react';
import { useI18n } from '../lib/i18n.jsx';

/* FAQ accordion. Gaya: .faq-* di index.css (pill hijau, aktif → kuning, ikon + / ×).
   Satu item terbuka pada satu waktu — sama seperti perilaku di main.js lama. */
export default function FaqSection() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState(null);
  const faqs = [1, 2, 3, 4, 5].map((n) => ({ q: t(`faq.${n}.q`), a: t(`faq.${n}.a`) }));

  const toggle = (i) => setOpenIndex((cur) => (cur === i ? null : i));

  return (
    <div className="container">
      <div className="faq-landing-section">
        <h2 className="faq-section-title text-center mb-4">
          <span className="highlight-oval-yellow">{t('faq.h1')}</span> {t('faq.h2')}<br />{t('faq.h3')}
        </h2>

        <div className="faq-accordion-custom mx-auto">
          {faqs.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.q} className={`faq-item-custom${open ? ' active' : ''}`} onClick={() => toggle(i)}>
                <div
                  className="faq-item-header"
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(i);
                    }
                  }}
                >
                  <span className="faq-question">{item.q}</span>
                  <span className="faq-toggle-btn" aria-hidden="true">
                    <i className={`bi ${open ? 'bi-x-lg' : 'bi-plus-lg'}`}></i>
                  </span>
                </div>
                <div className="faq-item-body">{item.a}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}