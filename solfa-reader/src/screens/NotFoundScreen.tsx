// Unknown `#/…` address.
import { goBack, navigate } from '../app/navigation';
import { useT } from '../i18n';
import { Button, EmptyState, TopBar } from '../ui';

/** Fallback screen for unknown routes. */
export default function NotFoundScreen() {
  const t = useT();
  return (
    <div className="sr-page" data-testid="screen-notfound">
      <TopBar title={t('notFound.title')} onBack={() => goBack()} backLabel={t('common.back')} />
      <main className="sr-container sr-page__body">
        <EmptyState
          icon="search"
          title={t('notFound.title')}
          description={t('notFound.desc')}
          actions={
            <Button variant="primary" onClick={() => navigate('/', { replace: true })}>
              {t('common.goHome')}
            </Button>
          }
        />
      </main>
    </div>
  );
}
