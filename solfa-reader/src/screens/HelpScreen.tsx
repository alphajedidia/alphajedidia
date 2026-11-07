// Help (I-08, FR-28): how to read / type sol-fa, each rule with a playable example, and photo
// tips. The examples are sol-fa notation (the same in every language), not translated text.
import { useEffect, useState } from 'react';
import { createPlayer, type SolfaPlayer } from '../audio';
import { goBack, navigate } from '../app/navigation';
import { setEditorDraft } from '../app/session';
import { useToast } from '../app/toasts';
import { buildSequence, parseSolfa } from '../core';
import { useT, type MessageKey } from '../i18n';
import { Button, Card, Icon, IconButton, TopBar } from '../ui';
import './HelpScreen.css';

interface Topic {
  id: string;
  title: MessageKey;
  body: MessageKey;
  example: string;
}

const TOPICS: readonly Topic[] = [
  { id: 'notes', title: 'help.notes.title', body: 'help.notes.body', example: "S: | d :r :m :f | s :l :t :d' |" },
  { id: 'octaves', title: 'help.octaves.title', body: 'help.octaves.body', example: "S: | d :s, :d :d' | s :s, :d :- |" },
  { id: 'beats', title: 'help.beats.title', body: 'help.beats.body', example: 'S: | d :m !s :m | d :- :- :- ||' },
  { id: 'holds', title: 'help.holds.title', body: 'help.holds.body', example: 'S: | d :- :m : | s :- :- :- |' },
  { id: 'division', title: 'help.division.title', body: 'help.division.body', example: 'S: | d.r :m.f :s.,f :m,r.d | d,r,m :f :s :- |' },
  { id: 'chromatic', title: 'help.chromatic.title', body: 'help.chromatic.body', example: 'S: | s :fe :s :l | ta :l :s :- |' },
  {
    id: 'voices',
    title: 'help.voices.title',
    body: 'help.voices.body',
    example: 'S: | m :f  :s  :- |\nA: | d :d  :t, :- |\nT: | s :l  :s  :- |\nB: | d :f, :s, :- |',
  },
  { id: 'words', title: 'help.words.title', body: 'help.words.body', example: 'S: | d :r :m :- |\nW: Ha-le-lu-ia' },
  { id: 'headers', title: 'help.headers.title', body: 'help.headers.body', example: 'title: Hira\nkey: G\ntime: 3/4\ntempo: 72\n\nS: | d :r :m | s :- :- |' },
];

const FULL_EXAMPLE = `title: Hira fiderana
key: G
time: 4/4
tempo: 84

S: | m  :m  :f  :s  | s  :f  :m  :r  |
A: | d  :d  :l, :t, | d  :l, :d  :t, |
T: | s  :s  :f  :r  | m  :r  :s  :s  |
B: | d, :d, :r, :s, | d, :f, :d, :s, |
W: Ry To-mpo ô, de-ra-in-ay i-an-ao

S: | d' :t  :l  :s  | s  :-  :-  :-  ||
A: | m  :r  :f  :d  | t, :-  :-  :-  ||
T: | s  :s  :f  :m  | r  :-  :-  :-  ||
B: | d  :s, :l, :d  | s, :-  :-  :-  ||`;

/** `#/help`. */
export default function HelpScreen() {
  const t = useT();
  const toast = useToast();
  const [player, setPlayer] = useState<SolfaPlayer | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    const p = createPlayer();
    setPlayer(p);
    const off = p.subscribe((pos) => {
      if (pos.state !== 'playing') setPlaying(null);
    });
    return () => {
      off();
      p.dispose();
    };
  }, []);

  const listen = (id: string, example: string) => {
    if (!player) return;
    if (playing === id) {
      player.stop();
      return;
    }
    player.stop();
    const text = /^\s*(key|tempo)\s*:/m.test(example) ? example : `key: C\ntempo: 100\n\n${example}`;
    const song = parseSolfa(text).song;
    player.load(buildSequence(song));
    player.setTempo(song.tempo);
    player.seek(0);
    setPlaying(id);
    // Inside the tap handler, nothing awaited before: phones unlock audio here.
    player.play().catch(() => {
      setPlaying(null);
      toast.show({ id: 'audio', message: t('player.noAudio'), tone: 'error' });
    });
  };

  const listenButton = (id: string, example: string) => (
    <IconButton
      icon={playing === id ? 'stop' : 'play'}
      variant="secondary"
      label={t('help.listen')}
      pressed={playing === id}
      onClick={() => listen(id, example)}
    />
  );

  return (
    <div className="sr-page" data-testid="screen-help">
      <TopBar title={t('help.title')} onBack={() => goBack()} backLabel={t('common.back')} />
      <main className="sr-container sr-page__body sr-stack sr-help">
        {TOPICS.map((topic) => (
          <Card key={topic.id} as="section" title={t(topic.title)} actions={listenButton(topic.id, topic.example)}>
            <div className="sr-stack sr-stack--sm">
              <p>{t(topic.body)}</p>
              <pre className="sr-solfa-text sr-help__example">{topic.example}</pre>
            </div>
          </Card>
        ))}
        <Card as="section" title={t('help.keypad.title')}>
          <p>{t('help.keypad.body')}</p>
        </Card>
        <Card as="section" title={t('help.example.title')} actions={listenButton('full', FULL_EXAMPLE)}>
          <div className="sr-stack sr-stack--sm">
            <pre className="sr-solfa-text sr-help__example">{FULL_EXAMPLE}</pre>
            <Button
              icon="edit"
              onClick={() => {
                setEditorDraft(FULL_EXAMPLE);
                navigate('/new');
              }}
            >
              {t('help.tryIt')}
            </Button>
          </div>
        </Card>
        <Card as="section" tone="brand" title={t('help.photo.title')}>
          <ul className="sr-tips">
            {(['scan.tip1', 'scan.tip2', 'scan.tip3', 'help.photo.tip4', 'help.photo.tip5', 'help.photo.tip6'] as const).map((k) => (
              <li key={k}>
                <Icon name="check-circle" size={20} />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
