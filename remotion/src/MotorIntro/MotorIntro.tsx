import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

type MotorIntroProps = {
  title: string;
  subtitle: string;
};

export const MotorIntro: React.FC<MotorIntroProps> = ({title, subtitle}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: {damping: 200},
  });

  const subtitleOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const glowOpacity = interpolate(frame, [0, 60, 150], [0.15, 0.35, 0.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0f1115',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 40%, rgba(255, 106, 61, ${glowOpacity}), transparent 60%)`,
        }}
      />
      <div
        style={{
          transform: `scale(${titleScale})`,
          color: '#e8eaed',
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        Motor<span style={{color: '#ff6a3d'}}>{title.replace('Motor', '')}</span>
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          color: '#9aa0ac',
          fontSize: 40,
          marginTop: 24,
        }}
      >
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};
