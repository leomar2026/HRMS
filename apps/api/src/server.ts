import { app } from "./app.js";
import { env } from "./config/env.js";
import { startBiometricScheduler } from "./services/biometricScheduler.js";

app.listen(env.API_PORT, () => {
  if (!env.HRMS_PREVIEW_MODE) startBiometricScheduler();
  console.log(`Saudi HRMS API listening on http://localhost:${env.API_PORT}`);
});
