// Error boundary per screen: a crash shows a friendly message with "go home" instead of a
// blank page. Lazy chunks that fail to load (offline before the first full visit) get their own
// message and a reload button.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useT } from '../i18n';
import { Button, EmptyState } from '../ui';
import { navigate } from './navigation';

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

function isChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch/i.test(msg);
}

function ErrorView({ error, onReset }: { error: unknown; onReset: () => void }) {
  const t = useT();
  const chunk = isChunkError(error);
  return (
    <main className="sr-container sr-screen__body" data-testid="screen-error">
      <EmptyState
        tone="error"
        icon="warning"
        title={t('error.title')}
        description={chunk ? t('error.chunk') : t('error.desc')}
        actions={
          <>
            <Button
              variant="primary"
              icon="music"
              block
              onClick={() => {
                onReset();
                navigate('/', { replace: true });
              }}
            >
              {t('common.goHome')}
            </Button>
            <Button icon="redo" block onClick={() => window.location.reload()}>
              {t('error.reload')}
            </Button>
          </>
        }
      />
    </main>
  );
}

/** Catches render errors of one screen. Reset it with a new `key` (route change). */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error ?? new Error('unknown error') };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[app] screen crashed', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) return <ErrorView error={this.state.error} onReset={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
