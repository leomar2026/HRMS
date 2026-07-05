import { env } from "../config/env.js";
import { getConnectorStatus } from "./connectorBase.js";

export function getMudadStatus() {
  return getConnectorStatus({
    name: "Mudad",
    apiUrl: env.MUDAD_API_URL,
    clientId: env.MUDAD_CLIENT_ID,
    clientSecret: env.MUDAD_CLIENT_SECRET
  });
}
