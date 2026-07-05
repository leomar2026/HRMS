type ConnectorConfig = {
  name: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
};

export function getConnectorStatus(config: ConnectorConfig) {
  return {
    name: config.name,
    configured: Boolean(config.apiUrl && config.clientId && config.clientSecret),
    apiUrlConfigured: Boolean(config.apiUrl),
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    message: "Official integration requires approved API access, company authorization, and official credentials."
  };
}
