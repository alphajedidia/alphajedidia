import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { IconButton } from '../components/IconButton';
import { List, ListItem } from '../components/ListItem';
import { Logo } from '../components/Logo';
import { ProgressBar } from '../components/ProgressBar';
import { SegmentedControl } from '../components/SegmentedControl';
import { Slider } from '../components/Slider';
import { Spinner } from '../components/Spinner';
import { Switch } from '../components/Switch';
import { Toast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import { VoiceBadge } from '../components/VoiceBadge';
import { Icon } from '../icons/Icon';
import { VOICE_ORDER } from '../voices';
import { GallerySection } from './GallerySection';

const noop = () => undefined;

/** Buttons, bars, cards, lists, form controls, feedback. */
export function CoreSection() {
  const [tempo, setTempo] = useState(84);
  const [count, setCount] = useState(true);
  const [metro, setMetro] = useState(false);
  const [instrument, setInstrument] = useState<'piano' | 'organ' | 'voice'>('piano');
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState(true);

  return (
    <>
      <GallerySection id="buttons" title="Button">
        <div className="sr-stack sr-stack--sm">
          <div className="sr-cluster">
            <Button variant="primary" icon="play">Primary</Button>
            <Button icon="edit">Secondary</Button>
            <Button variant="ghost" icon="share">Ghost</Button>
            <Button variant="danger" icon="trash">Danger</Button>
          </div>
          <div className="sr-cluster">
            <Button size="sm">Small 44</Button>
            <Button>Medium 48</Button>
            <Button variant="primary" size="lg" iconEnd="chevron-right">Large 56</Button>
          </div>
          <div className="sr-cluster">
            <Button variant="primary" loading>Saving…</Button>
            <Button disabled>Disabled</Button>
          </div>
          <Button variant="primary" size="lg" icon="camera" block>Block primary</Button>
        </div>
      </GallerySection>

      <GallerySection id="iconbuttons" title="IconButton">
        <div className="sr-cluster">
          <IconButton icon="more" label="More" />
          <IconButton icon="undo" label="Undo" variant="secondary" />
          <IconButton icon="loop" label="Loop" pressed />
          <IconButton icon="play" label="Play" variant="primary" size="xl" />
          <IconButton icon="trash" label="Delete" variant="danger" />
          <IconButton icon="share" label="Share" disabled />
          <IconButton icon="play" label="Loading" variant="primary" size="lg" loading />
        </div>
      </GallerySection>

      <GallerySection id="topbar" title="TopBar" note="Brand (navy cover) and plain variants.">
        <div className="sr-stack sr-stack--sm sr-gallery__bleed">
          <TopBar
            sticky={false}
            leading={<Logo size={32} />}
            title="Solfa Reader"
            actions={
              <>
                <IconButton icon="help" label="Help" />
                <IconButton icon="settings" label="Settings" />
              </>
            }
          />
          <TopBar
            sticky={false}
            titleAs="div"
            onBack={noop}
            title="Hira fiderana"
            subtitle="Do = G · 4/4 · 84"
            actions={
              <>
                <IconButton icon="share" label="Share" />
                <IconButton icon="more" label="More" />
              </>
            }
          />
          <TopBar sticky={false} titleAs="div" variant="plain" onBack={noop} title="Settings" />
        </div>
      </GallerySection>

      <GallerySection id="cards" title="Card · List · ListItem">
        <div className="sr-stack">
          <Card
            title="Practise my part"
            subtitle="Choose your voice"
            actions={<IconButton icon="more" label="More" />}
            footer={<Button variant="primary" icon="play">Play</Button>}
          >
            <div className="sr-cluster">
              {VOICE_ORDER.map((v) => (
                <VoiceBadge key={v} voice={v} />
              ))}
            </div>
          </Card>
          <List>
            <ListItem
              leading={<Icon name="music" />}
              title="Hira fiderana"
              subtitle="Scanned · 4 voices"
              meta="Today"
              onClick={noop}
              trailing={<IconButton icon="more" label="More" />}
            />
            <ListItem leading={<Icon name="file" />} title="Tompo ô, mitahy" subtitle="Typed" meta="3 Nov" onClick={noop} selected />
            <ListItem leading={<Icon name="book" />} title="Sample: scale exercise" subtitle="Sample" onClick={noop} />
            <ListItem leading={<Icon name="info" />} title="Static row" subtitle="Not clickable" />
          </List>
        </div>
      </GallerySection>

      <GallerySection id="forms" title="Field · Slider · Switch · SegmentedControl">
        <div className="sr-stack">
          <Field
            label="Search my songs"
            hideLabel
            icon="search"
            placeholder="Search my songs"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            trailing={query ? <IconButton icon="close" label="Clear" onClick={() => setQuery('')} /> : null}
          />
          <Field label="Title" defaultValue="Hira fiderana" hint="Shown in your library and in shared links." />
          <Field label="Key" defaultValue="H" error="Use a note name like G, Bb or Sol." />
          <Field label="Sol-fa text" multiline mono rows={3} defaultValue={'S: | m :m :f :s |\nA: | d :d :d :t, |'} />
          <Slider label="Tempo" value={tempo} min={40} max={200} onChange={setTempo} formatValue={(v) => `${v} BPM`} decrementLabel="Slower" incrementLabel="Faster" />
          <Switch label="Count-in" description="One bar of clicks before the music" checked={count} onChange={setCount} />
          <Switch label="Metronome" checked={metro} onChange={setMetro} />
          <Switch label="Disabled" checked={false} onChange={noop} disabled />
          <SegmentedControl
            label="Instrument"
            block
            value={instrument}
            onChange={setInstrument}
            options={[
              { value: 'piano', label: 'Piano', icon: 'piano' },
              { value: 'organ', label: 'Organ', icon: 'music' },
              { value: 'voice', label: 'Voice', icon: 'headphones' },
            ]}
          />
        </div>
      </GallerySection>

      <GallerySection id="chips" title="Chip · VoiceBadge">
        <div className="sr-stack sr-stack--sm">
          <div className="sr-cluster">
            <Chip label="2 errors" tone="danger" icon="error" />
            <Chip label="1 warning" tone="warning" icon="warning" />
            <Chip label="Saved" tone="success" icon="check" />
            <Chip label="Do = G" tone="brand" />
            <Chip label="Pick-up" />
          </div>
          <div className="sr-cluster">
            <Chip label="Bars 5–8" icon="loop" selected={chip} onClick={() => setChip(!chip)} />
            <Chip label="Handwritten" onClick={noop} />
            <Chip label="Tenor" voice="T" onRemove={noop} />
          </div>
          <div className="sr-cluster">
            {VOICE_ORDER.map((v) => (
              <VoiceBadge key={v} voice={v} showName />
            ))}
          </div>
          <div className="sr-cluster">
            {VOICE_ORDER.map((v) => (
              <VoiceBadge key={v} voice={v} variant="soft" size="lg" />
            ))}
            {VOICE_ORDER.map((v) => (
              <VoiceBadge key={v} voice={v} variant="outline" size="sm" />
            ))}
          </div>
        </div>
      </GallerySection>

      <GallerySection id="feedback" title="ProgressBar · Spinner · Toast">
        <div className="sr-stack">
          <ProgressBar label="Reading the photo…" value={0.45} valueText="45 %" />
          <ProgressBar label="Preparing the reader (first time only)" valueText="Step 1 of 3" />
          <div className="sr-cluster">
            <Spinner size="sm" />
            <Spinner />
            <Spinner size="lg" label="Loading" />
          </div>
          <Toast message="Song saved" tone="success" onDismiss={noop} duration={0} />
          <Toast message="Song deleted" action={{ label: 'Undo', onClick: noop }} onDismiss={noop} duration={0} />
          <Toast message="Could not read this photo." tone="error" onDismiss={noop} duration={0} />
          <Toast message="You are offline. Songs still play." tone="info" duration={0} />
        </div>
      </GallerySection>

      <GallerySection id="empty" title="EmptyState">
        <div className="sr-stack">
          <Card padding="none">
            <EmptyState
              art={<Logo size={72} />}
              title="No songs yet"
              description="Take a photo of a sol-fa score, or type one."
              actions={
                <>
                  <Button variant="primary" size="lg" icon="camera" block>Scan a score</Button>
                  <Button icon="keyboard" block>Type a song</Button>
                </>
              }
            />
          </Card>
          <Card padding="none">
            <EmptyState
              tone="error"
              icon="warning"
              title="No music found in this photo"
              description="Hold the phone straight above the page, in good light, and try again."
              actions={<Button variant="primary" icon="camera" block>Try again</Button>}
            />
          </Card>
        </div>
      </GallerySection>
    </>
  );
}
