import {AbsoluteFill, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {IntroTitle} from './IntroTitle';
import {Caption} from './Caption';
import {ProgressBar} from './ProgressBar';

const INTRO_FRAMES = 90;
const VIDEO_FRAMES = 3605;

const captions: {fromSec: number; durationSec: number; text: string}[] = [
  {fromSec: 11, durationSec: 5, text: 'Cada leyenda empieza con una caída'},
  {fromSec: 59, durationSec: 5, text: 'Lo que importa es cómo te levantás'},
  {fromSec: 98, durationSec: 6, text: 'El fracaso no es el final de la historia'},
  {fromSec: 108, durationSec: 6, text: 'Es apenas el comienzo de una más grande'},
];

export const RiseAfterFalling: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <IntroTitle />
      </Sequence>

      <Sequence from={INTRO_FRAMES} durationInFrames={VIDEO_FRAMES}>
        <AbsoluteFill>
          <OffthreadVideo src={staticFile('videos/rise-after-falling.mp4')} />
          <ProgressBar totalFrames={VIDEO_FRAMES} />
          {captions.map((c) => (
            <Sequence
              key={c.text}
              from={c.fromSec * 30}
              durationInFrames={c.durationSec * 30}
            >
              <Caption text={c.text} durationInFrames={c.durationSec * 30} />
            </Sequence>
          ))}
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
