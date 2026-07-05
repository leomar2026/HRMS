import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.API_PORT, () => {
  console.log(`Saudi HRMS API listening on http://localhost:${env.API_PORT}`);
});
