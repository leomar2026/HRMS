import { env } from "../config/env.js";
import { getConnectorStatus } from "./connectorBase.js";

export function getGosiStatus() {
  return getConnectorStatus({
    name: "GOSI",
    apiUrl: env.GOSI_API_URL,
    clientId: env.GOSI_CLIENT_ID,
    clientSecret: env.GOSI_CLIENT_SECRET
  });
}
