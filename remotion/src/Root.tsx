import {Composition} from 'remotion';
import {MotorIntro} from './MotorIntro/MotorIntro';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MotorIntro"
        component={MotorIntro}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'MotorHub',
          subtitle: 'Potencia, precisión y rendimiento',
        }}
      />
    </>
  );
};
