import { useRef, useState } from 'react';
import {
  SoapBubbleButton,
  SoapBubbleIconButton,
  SoapBubbleMaterial,
  SoapBubbleMenu,
  SoapBubbleSearch,
  SoapBubbleSlider,
  SoapBubbleToggle,
} from './index';

export function Example() {
  const page = useRef<HTMLDivElement>(null);
  const [wifi, setWifi] = useState(true);
  const [volume, setVolume] = useState(40);
  return (
    <div ref={page} className="page" data-theme="light" style={{ background: '#f7f7f8', color: '#1b1d22', padding: '1.5rem', borderRadius: '1.5rem' }}>
      <SoapBubbleMaterial backdrop={page}
        iridescence={0.5}
        oilCoverage={0.73}
        oilEdgeFade={2.33}
        clearCenter={0.57}
        windowLength={1.3}
        windowMargin={0.85}
        windowBend={0.75}
        windowSize={0.75}
        windowWidth={0.8}
        windowGradient={0.96}
        windowHead={0.7}
        windowTail={0.6}
        glintSize={1.65}
        glintIntensity={0}
        glintDistance={-0.45}
        glintHeight={0.65}
        windowIntensity={0.85}
        windowTwin={false}
        bottomShadeColor="#ffffff"
      >
        <div style={{ display: 'grid', gap: '1em', fontSize: 28, maxWidth: '420px', margin: '0 auto' }}>
        <header style={{ display: 'flex', gap: '0.55em' }}>
          <SoapBubbleMenu
            round
            label="•••"
            triggerLabel="More"
            items={[{ label: 'Select chats' }, { label: 'Read all' }]}
          />
          <SoapBubbleIconButton aria-label="Camera" style={{ marginLeft: 'auto' }}>📷</SoapBubbleIconButton>
          <SoapBubbleIconButton aria-label="New" tint="rgb(52 199 89)" opacity={0.92}>+</SoapBubbleIconButton>
        </header>
        <SoapBubbleSearch placeholder="Search" />
        <SoapBubbleToggle checked={wifi} onCheckedChange={setWifi} aria-label="Wi-Fi" scale={2.75} />
        <SoapBubbleSlider value={volume} onValueChange={setVolume} label="Volume" from="#0a84ff" scale={3} />
        <SoapBubbleButton>Continue</SoapBubbleButton>
        </div>
      </SoapBubbleMaterial>
    </div>
  );
}

export default Example;
