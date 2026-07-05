import { env } from "../config/env.js";
import { getConnectorStatus } from "./connectorBase.js";

export function getQiwaStatus() {
  return getConnectorStatus({
    name: "Qiwa",
    apiUrl: env.QIWA_API_URL,
    clientId: env.QIWA_CLIENT_ID,
    clientSecret: env.QIWA_CLIENT_SECRET
  });
}
