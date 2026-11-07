// Settings (I-08): language, theme, default instrument, count-in, score text size, about.
import { useRef } from 'react';
import { version } from '../../package.json';
import { useTestIds } from '../app/hooks';
import { addSamples } from '../app/library';
import { goBack, navigate } from '../app/navigation';
import { useSettings, type TextSize } from '../app/settings';
import { useToast } from '../app/toasts';
import type { InstrumentId } from '../audio';
import { useT, type Lang } from '../i18n';
import { getStorageBackend, type ThemePref } from '../storage';
import { Card, Icon, List, ListItem, SegmentedControl, Switch, TopBar } from '../ui';
import './SettingsScreen.css';

/** `#/settings`. */
export default function SettingsScreen() {
  const t = useT();
  const toast = useToast();
  const { settings, update, prefs, updatePrefs } = useSettings();
  const langRef = useRef<HTMLDivElement>(null);
  useTestIds(langRef, '[role="radio"]', ['lang-mg', 'lang-en', 'lang-fr']);
  const persistent = getStorageBackend().persistent;

  return (
    <div className="sr-page" data-testid="screen-settings">
      <TopBar title={t('settings.title')} onBack={() => goBack()} backLabel={t('common.back')} />
      <main className="sr-container sr-page__body sr-stack sr-stack--lg sr-settings">
        {!persistent && (
          <Card tone="sunken">
            <p className="sr-settings__warn">
              <Icon name="warning" /> {t('app.notPersistent')}
            </p>
          </Card>
        )}
        <section className="sr-stack sr-stack--sm" aria-labelledby="set-lang">
          <h2 id="set-lang" className="sr-section-title">
            {t('settings.language')}
          </h2>
          <div ref={langRef}>
            <SegmentedControl<Lang>
              label={t('settings.language')}
              block
              value={settings.language}
              onChange={(language) => update({ language })}
              options={[
                { value: 'mg', label: t('lang.mg') },
                { value: 'en', label: t('lang.en') },
                { value: 'fr', label: t('lang.fr') },
              ]}
            />
          </div>
        </section>

        <section className="sr-stack sr-stack--sm" aria-labelledby="set-theme">
          <h2 id="set-theme" className="sr-section-title">
            {t('settings.appearance')}
          </h2>
          <SegmentedControl<ThemePref>
            label={t('settings.appearance')}
            block
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'auto', label: t('theme.auto'), icon: 'settings' },
              { value: 'light', label: t('theme.light'), icon: 'sun' },
              { value: 'dark', label: t('theme.dark'), icon: 'moon' },
            ]}
          />
        </section>

        <section className="sr-stack sr-stack--sm" aria-labelledby="set-sound">
          <h2 id="set-sound" className="sr-section-title">
            {t('settings.sound')}
          </h2>
          <SegmentedControl<InstrumentId>
            label={t('settings.defaultInstrument')}
            block
            value={settings.instrument}
            onChange={(instrument) => update({ instrument })}
            options={[
              { value: 'piano', label: t('instrument.piano'), icon: 'piano' },
              { value: 'organ', label: t('instrument.organ'), icon: 'music' },
              { value: 'voice', label: t('instrument.voice'), icon: 'headphones' },
            ]}
          />
          <Switch
            label={t('player.countIn')}
            description={t('player.countInDesc')}
            checked={settings.countIn}
            onChange={(countIn) => update({ countIn })}
          />
          <div className="sr-settings__row">
            <span className="sr-settings__label">{t('settings.textSize')}</span>
            <SegmentedControl<TextSize>
              label={t('settings.textSize')}
              value={prefs.textSize}
              onChange={(textSize) => updatePrefs({ textSize })}
              options={[
                { value: 'md', label: 'A' },
                { value: 'lg', label: 'A+' },
                { value: 'xl', label: 'A++' },
              ]}
            />
          </div>
        </section>

        <section className="sr-stack sr-stack--sm" aria-labelledby="set-about">
          <h2 id="set-about" className="sr-section-title">
            {t('settings.about')}
          </h2>
          <List>
            <ListItem leading={<Icon name="help" />} title={t('settings.howTo')} onClick={() => navigate('/help')} />
            <ListItem
              leading={<Icon name="book" />}
              title={t('settings.restoreSamples')}
              chevron={false}
              onClick={() => {
                void addSamples().then(() => toast.show({ message: t('settings.samplesRestored'), tone: 'success' }));
              }}
            />
            <ListItem leading={<Icon name="check-circle" />} title={t('settings.privacy')} subtitle={t('settings.privacyDesc')} />
            <ListItem leading={<Icon name="info" />} title={t('settings.version', { version })} subtitle={t('settings.free')} />
          </List>
        </section>
      </main>
    </div>
  );
}
