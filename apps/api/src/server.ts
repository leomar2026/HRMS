import { app } from "./app.js";
import { env } from "./config/env.js";
import { startBiometricScheduler } from "./services/biometricScheduler.js";

app.listen(env.API_PORT, () => {
  startBiometricScheduler();
  console.log(`Saudi HRMS API listening on http://localhost:${env.API_PORT}`);
});
