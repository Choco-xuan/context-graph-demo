/**
 * 高区分度调色板，色相按黄金角分布，适配暗色背景
 */

const COLOR_PALETTE = [
  "#FF6B6B", "#00D4AA", "#FFA94D", "#4DABF7", "#FFE066", "#9775FA",
  "#51CF66", "#F06595", "#20C997", "#748FFC", "#FFD43B", "#F783AC",
  "#38D9A9", "#5C7CFA", "#FFC078", "#CC5DE8", "#69DB7C", "#FF8787",
  "#22B8CF", "#DA77F2", "#A9E34B", "#FF922B", "#339AF0", "#E599F7",
];

/** 根据 label 生成稳定且高区分度的颜色 */
export function getColorForLabel(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}
