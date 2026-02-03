/**
 * 图谱展示与 AI 相关配置
 */

/** 领域/基底标签，渲染和 AI 问答时不展示，仅用于底层建模 */
export const DOMAIN_LABELS = ["GW"];

/** 从标签列表中过滤掉领域标签，用于展示 */
export function getDisplayLabels(labels: string[]): string[] {
  if (!labels?.length) return [];
  return labels.filter((l) => l && !DOMAIN_LABELS.includes(l));
}
