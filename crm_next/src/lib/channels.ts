export const CHANNEL_MAP = {
  naver:  { table: "naver_shopping_work", label: "네이버쇼핑" },
  place:  { table: "place_work",          label: "플레이스"   },
  inflow: { table: "inflow_work",         label: "유입플"     },
  blog:   { table: "blog_work",           label: "블로그"     },
  ohouse: { table: "ohouse_work",         label: "오늘의집"   },
  kakao:  { table: "kakao_work",          label: "카카오맵"   },
  auto:   { table: "auto_work",           label: "자동완성"   },
} as const;

export type ChannelKey = keyof typeof CHANNEL_MAP;

export function channelTable(key: ChannelKey): string {
  return CHANNEL_MAP[key].table;
}

export function channelLabel(key: string): string {
  return (CHANNEL_MAP as Record<string, { label: string }>)[key]?.label ?? key;
}

export function channelValid(key: string): key is ChannelKey {
  return key in CHANNEL_MAP;
}

export const CHANNEL_KEYS: ChannelKey[] = Object.keys(CHANNEL_MAP) as ChannelKey[];
