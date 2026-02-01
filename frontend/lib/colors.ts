/**
 * 高区分度调色板：节点类型与关系类型分别映射到不同颜色
 * 色相均匀分布，适配暗色背景
 */
const COLOR_PALETTE = [
  "#FF6B6B", "#00D4AA", "#FFA94D", "#4DABF7", "#FFE066", "#9775FA",
  "#51CF66", "#F06595", "#20C997", "#748FFC", "#FFD43B", "#F783AC",
  "#38D9A9", "#5C7CFA", "#FFC078", "#CC5DE8", "#69DB7C", "#FF8787",
  "#22B8CF", "#DA77F2", "#A9E34B", "#FF922B", "#339AF0", "#E599F7",
];

function hashToIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % COLOR_PALETTE.length;
}

/** 根据节点类型（label）生成稳定颜色，同类节点同色 */
export function getColorForLabel(label: string): string {
  const key = (label || "Unknown").trim();
  return COLOR_PALETTE[hashToIndex(key)];
}

/** 根据关系类型生成稳定颜色，同类关系同色（与节点颜色独立映射） */
export function getColorForRelationshipType(relType: string): string {
  const key = "rel:" + (relType || "REL").trim();
  return COLOR_PALETTE[hashToIndex(key)];
}
