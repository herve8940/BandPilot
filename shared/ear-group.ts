/** Ordered mixer source prefixes. The offset is a live trim in dB, relative to this session. */
export interface EarGroup {
  id: string;
  name: string;
  members: string[];
  revision: number;
  offset: number;
}
export const EAR_GROUP_RANGE = 12;
