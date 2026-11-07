// Parser problems under the editor text (FR-14): the first one is always visible, the rest on
// demand; tapping one selects the place in the text.
import { useState } from 'react';
import { describeDiagnostic } from '../../app/diagnostics';
import type { Diagnostic } from '../../core';
import { useI18n } from '../../i18n';
import { Icon, type IconName } from '../../ui';

const SEVERITY_ICON: Record<Diagnostic['severity'], IconName> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

export interface DiagnosticsPanelProps {
  diagnostics: readonly Diagnostic[];
  text: string;
  onPick: (d: Diagnostic) => void;
  /** Rows shown before "show all". */
  collapsedCount?: number;
}

/** List of translated diagnostics. Renders nothing when there are none. */
export function DiagnosticsPanel({ diagnostics, text, onPick, collapsedCount = 1 }: DiagnosticsPanelProps) {
  const { t, messages } = useI18n();
  const [expanded, setExpanded] = useState(false);
  if (diagnostics.length === 0) return null;
  const extra = diagnostics.length - collapsedCount;
  return (
    <div className="sr-diags">
      <ul className={expanded ? 'sr-diags__list is-expanded' : 'sr-diags__list'} aria-label={t('editor.problemList')} data-testid="diagnostics">
        {diagnostics.map((d, i) => {
          const { message, where } = describeDiagnostic(d, text, t, messages);
          return (
            <li key={`${d.code}-${d.line}-${d.col}-${i}`} hidden={!expanded && i >= collapsedCount} data-testid="diagnostic">
              <button type="button" className={`sr-diags__item sr-diags__item--${d.severity}`} onClick={() => onPick(d)}>
                <Icon name={SEVERITY_ICON[d.severity]} size={20} className="sr-diags__icon" />
                <span className="sr-diags__text">
                  <span className="sr-diags__msg">{message}</span>
                  {where && <span className="sr-diags__where">{where}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {extra > 0 && (
        <button type="button" className="sr-diags__more" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} />
          {expanded ? t('editor.showLess') : t('editor.showAll', { count: diagnostics.length })}
        </button>
      )}
    </div>
  );
}
