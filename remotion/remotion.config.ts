import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Use the Chromium headless shell that is already installed in this
// environment instead of letting Remotion download its own copy, since
// outbound access to remotion.media is blocked by the sandbox's network
// egress allowlist.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
