import {Composition} from 'remotion';
import {MotorIntro} from './MotorIntro/MotorIntro';
import {RiseAfterFalling} from './RiseAfterFalling';

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
      <Composition
        id="RiseAfterFalling"
        component={RiseAfterFalling}
        durationInFrames={90 + 3605}
        fps={30}
        width={960}
        height={720}
      />
    </>
  );
};
