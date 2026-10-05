export interface GameContext {
  readonly appId: string;
  readonly title: string;
  readonly url: string;
}

export interface ActionItem {
  readonly id: string;
  readonly label: string;
  readonly onExecute: (context: GameContext) => void;
}
