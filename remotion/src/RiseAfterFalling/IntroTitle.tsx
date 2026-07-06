import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

const Rings: React.FC<{opacity: number}> = ({opacity}) => {
  const colors = ['#0085C7', '#000000', '#DF0024', '#F4C300', '#009F3D'];
  return (
    <svg width={220} height={90} viewBox="0 0 220 90" style={{opacity}}>
      {colors.map((color, i) => (
        <circle
          key={color}
          cx={30 + i * 40}
          cy={i % 2 === 0 ? 35 : 55}
          r={26}
          fill="none"
          stroke={color}
          strokeWidth={8}
        />
      ))}
    </svg>
  );
};

export const IntroTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const ringsOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleScale = spring({frame: frame - 15, fps, config: {damping: 200}});

  const subtitleOpacity = interpolate(frame, [35, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [75, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeOut,
      }}
    >
      <Rings opacity={ringsOpacity} />
      <div
        style={{
          transform: `scale(${titleScale})`,
          color: '#fff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontWeight: 800,
          fontSize: 64,
          letterSpacing: 2,
          marginTop: 24,
          textAlign: 'center',
        }}
      >
        LEVANTARSE
        <br />
        DESPUÉS DE CAER
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          color: '#c7c7c7',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: 26,
          marginTop: 20,
          letterSpacing: 1,
        }}
      >
        Historias olímpicas de caída y superación
      </div>
    </AbsoluteFill>
  );
};
