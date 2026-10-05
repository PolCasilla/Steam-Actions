export interface GameContext {
  readonly appId: string;
  readonly title: string;
  readonly url: string;
}

export interface SettingsData {
  has_key: boolean;
  masked_key?: string;
  username?: string;
  daily_usage?: string | number;
  daily_limit?: string | number;
  expired?: boolean;
}

export interface RpcResult {
  success?: boolean;
  status?: number;
  message?: string;
}
