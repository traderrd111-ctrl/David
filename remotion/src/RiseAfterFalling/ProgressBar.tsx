import {useCurrentFrame, useVideoConfig} from 'remotion';

export const ProgressBar: React.FC<{totalFrames: number}> = ({totalFrames}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const progress = Math.min(frame / totalFrames, 1);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: 4,
        width: width * progress,
        background: '#f4c300',
      }}
    />
  );
};
