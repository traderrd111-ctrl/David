import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

type CaptionProps = {
  text: string;
  durationInFrames: number;
  accent?: string;
};

export const Caption: React.FC<CaptionProps> = ({text, durationInFrames, accent = '#f4c300'}) => {
  const frame = useCurrentFrame();

  const slideIn = interpolate(frame, [0, 15], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'flex-end'}}>
      <div
        style={{
          marginRight: 30,
          maxWidth: '48%',
          transform: `translateX(${slideIn}px)`,
          opacity,
          background: 'rgba(0, 0, 0, 0.55)',
          borderRight: `3px solid ${accent}`,
          padding: '12px 22px',
          color: '#fff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontWeight: 700,
          fontSize: 24,
          textAlign: 'right',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
