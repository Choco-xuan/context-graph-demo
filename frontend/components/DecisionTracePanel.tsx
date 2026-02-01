"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Text,
  Flex,
  Badge,
  VStack,
  HStack,
  Heading,
  Separator,
  Spinner,
  Button,
} from "@chakra-ui/react";
import {
  getSimilarDecisions,
  getCausalChain,
  type Decision,
  type SimilarDecision,
  type CausalChain,
  type GraphData,
} from "@/lib/api";
import { getColorForLabel } from "@/lib/colors";

interface InsightFilter {
  label?: string;
  relType?: string;
}

interface DecisionTracePanelProps {
  decision: Decision | null;
  onDecisionSelect: (decision: Decision) => void;
  graphDecisions?: Decision[]; // Decisions from the graph visualization
  graphData?: GraphData | null; // Full graph for insights when no decisions
  insightFilter?: InsightFilter | null; // 图谱洞察联动筛选
  onInsightFilterChange?: (filter: InsightFilter | null) => void;
}

const DECISION_TYPE_COLORS: Record<string, string> = {
  approval: "green",
  rejection: "red",
  escalation: "purple",
  exception: "yellow",
  override: "orange",
  credit_approval: "green",
  credit_denial: "red",
  fraud_alert: "red",
  fraud_cleared: "green",
  trading_approval: "blue",
  trading_halt: "orange",
  exception_granted: "yellow",
  exception_denied: "red",
};

const CATEGORY_COLORS: Record<string, string> = {
  fraud: "red",
  credit: "blue",
  compliance: "purple",
  trading: "cyan",
  account_management: "green",
  support: "orange",
};

/** 从图谱数据计算洞察：节点类型分布、关系类型分布 */
function computeGraphInsights(data: GraphData | null | undefined) {
  if (!data?.nodes?.length) return null;
  const labelCounts: Record<string, number> = {};
  const relTypeCounts: Record<string, number> = {};
  data.nodes.forEach((n) => {
    n.labels.forEach((l) => {
      if (!n.properties.isSchemaNode) labelCounts[l] = (labelCounts[l] || 0) + 1;
    });
  });
  data.relationships?.forEach((r) => {
    relTypeCounts[r.type] = (relTypeCounts[r.type] || 0) + 1;
  });
  const totalNodes = Object.values(labelCounts).reduce((a, b) => a + b, 0);
  const totalRels = Object.values(relTypeCounts).reduce((a, b) => a + b, 0);
  if (totalNodes === 0) return null;
  return { labelCounts, relTypeCounts, totalNodes, totalRels };
}

export function DecisionTracePanel({
  decision,
  onDecisionSelect,
  graphDecisions = [],
  graphData,
  insightFilter,
  onInsightFilterChange,
}: DecisionTracePanelProps) {
  const [similarDecisions, setSimilarDecisions] = useState<SimilarDecision[]>(
    [],
  );
  const [causalChain, setCausalChain] = useState<CausalChain | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!decision) {
      setSimilarDecisions([]);
      setCausalChain(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [similar, chain] = await Promise.all([
          getSimilarDecisions(decision.id, 5, "hybrid"),
          getCausalChain(decision.id, 2),
        ]);
        setSimilarDecisions(similar);
        setCausalChain(chain);
      } catch (error) {
        console.error("Failed to fetch decision data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [decision]);

  // Only show decisions from the graph
  const decisionsToShow = graphDecisions;

  // Show decisions list when no decision is selected
  if (!decision) {
    const insights = computeGraphInsights(graphData);
    const hasFilter = !!(insightFilter?.label || insightFilter?.relType);
    return (
      <Box p={4}>
        <VStack gap={4} align="stretch">
          {graphDecisions.length > 0 ? (
            <Badge colorPalette="blue" size="sm" alignSelf="flex-start">
              图中共 {graphDecisions.length} 个决策
            </Badge>
          ) : null}

          {decisionsToShow.length > 0 ? (
            <VStack gap={2} align="stretch">
              {decisionsToShow.map((d) => (
                <RecentDecisionCard
                  key={d.id}
                  decision={d}
                  onClick={() => onDecisionSelect(d)}
                />
              ))}
            </VStack>
          ) : insights ? (
            <VStack gap={3} align="stretch">
              {hasFilter && onInsightFilterChange ? (
                <Button
                  size="xs"
                  variant="ghost"
                  colorPalette="gray"
                  alignSelf="flex-end"
                  onClick={() => onInsightFilterChange(null)}
                >
                  清除筛选
                </Button>
              ) : null}
              <Box
                p={3}
                borderRadius="md"
                bg="whiteAlpha.50"
                borderWidth="1px"
                borderColor="whiteAlpha.100"
              >
                <Text fontSize="xs" color="gray.400" mb={2}>
                  共 {insights.totalNodes} 个节点，{insights.totalRels} 条关系
                  {hasFilter ? " · 已筛选" : ""}
                </Text>
                <VStack align="stretch" gap={1}>
                  <Text fontSize="xs" fontWeight="semibold" color="gray.300">
                    节点类型（点击筛选）
                  </Text>
                  <Flex gap={2} flexWrap="wrap">
                    {Object.entries(insights.labelCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, count]) => {
                        const isActive = insightFilter?.label === label;
                        const bg = getColorForLabel(label);
                        return (
                          <Badge
                            key={label}
                            size="sm"
                            bg={isActive ? "cyan.500" : bg}
                            color="white"
                            opacity={isActive ? 1 : 0.9}
                            cursor={onInsightFilterChange ? "pointer" : "default"}
                            _hover={onInsightFilterChange ? { opacity: 1 } : {}}
                            onClick={() =>
                              onInsightFilterChange?.(
                                isActive ? (insightFilter?.relType ? { relType: insightFilter.relType } : null) : { ...insightFilter, label }
                              )
                            }
                          >
                            {label}: {count}
                          </Badge>
                        );
                      })}
                  </Flex>
                  {Object.keys(insights.relTypeCounts).length > 0 && (
                    <>
                      <Text fontSize="xs" fontWeight="semibold" color="gray.300" mt={2}>
                        关系类型（点击筛选）
                      </Text>
                      <Flex gap={2} flexWrap="wrap">
                        {Object.entries(insights.relTypeCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 12)
                          .map(([type, count]) => {
                            const isActive = insightFilter?.relType === type;
                            const bg = getColorForLabel(type);
                            return (
                              <Badge
                                key={type}
                                size="sm"
                                bg={isActive ? "purple.500" : bg}
                                color="white"
                                opacity={isActive ? 1 : 0.9}
                                cursor={onInsightFilterChange ? "pointer" : "default"}
                                _hover={onInsightFilterChange ? { opacity: 1 } : {}}
                                onClick={() =>
                                  onInsightFilterChange?.(
                                    isActive ? (insightFilter?.label ? { label: insightFilter.label } : null) : { ...insightFilter, relType: type }
                                  )
                                }
                              >
                                {type}: {count}
                              </Badge>
                            );
                          })}
                      </Flex>
                    </>
                  )}
                </VStack>
              </Box>
              <Text fontSize="xs" color="gray.500">
                使用 AI 助手探索节点或提问「当前图谱中有哪些核心节点？」
              </Text>
            </VStack>
          ) : (
            <Text color="gray.400" textAlign="center" py={4}>
              图中暂无数据，请等待加载或使用 AI 助手搜索。
            </Text>
          )}
        </VStack>
      </Box>
    );
  }

  const typeColor = DECISION_TYPE_COLORS[decision.decision_type] || "gray";
  const categoryColor = CATEGORY_COLORS[decision.category] || "gray";

  return (
    <Box p={4}>
      <VStack gap={4} align="stretch">
        {/* Back button */}
        <Button
          size="sm"
          variant="outline"
          colorPalette="gray"
          borderColor="whiteAlpha.300"
          color="gray.300"
          _hover={{ bg: "whiteAlpha.100", borderColor: "whiteAlpha.400" }}
          onClick={() => onDecisionSelect(null as unknown as Decision)}
        >
          ← 返回列表
        </Button>

        {/* Decision Header */}
        <Box>
          <HStack gap={2} mb={2} flexWrap="wrap">
            <Badge colorPalette={typeColor} size="lg">
              {decision.decision_type.replace(/_/g, " ")}
            </Badge>
            <Badge colorPalette={categoryColor} variant="outline">
              {decision.category}
            </Badge>
            <Badge
              colorPalette={
                decision.status === "approved"
                  ? "green"
                  : decision.status === "rejected"
                    ? "red"
                    : "yellow"
              }
            >
              {decision.status}
            </Badge>
          </HStack>
          <Text fontSize="sm" color="gray.400">
            {decision.timestamp
              ? new Date(decision.timestamp).toLocaleString()
              : "日期未知"}
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>
            ID: {decision.id.slice(0, 8)}...
          </Text>
        </Box>

        <Separator borderColor="whiteAlpha.200" />

        {/* Reasoning */}
        <Box>
          <Heading size="sm" mb={2} color="gray.100">
            推理说明
          </Heading>
          <Box
            bg="gray.800"
            color="gray.200"
            p={3}
            borderRadius="md"
            fontSize="sm"
            whiteSpace="pre-wrap"
            borderWidth="1px"
            borderColor="whiteAlpha.100"
          >
            {decision.reasoning || "未提供推理说明。"}
          </Box>
        </Box>

        {/* Confidence */}
        <HStack gap={4}>
          <Box>
            <Text fontSize="xs" color="gray.400" mb={1}>
              置信度
            </Text>
            <Text fontWeight="medium" color="gray.100">
              {(decision.confidence ?? decision.confidence_score)
                ? `${((decision.confidence ?? decision.confidence_score ?? 0) * 100).toFixed(0)}%`
                : "无"}
            </Text>
          </Box>
        </HStack>

        {/* Risk Factors */}
        {Array.isArray(decision.risk_factors) &&
          decision.risk_factors.length > 0 && (
            <Box>
              <Heading size="sm" mb={2} color="gray.100">
                风险因素
              </Heading>
              <Flex gap={2} flexWrap="wrap">
                {decision.risk_factors.map((factor, idx) => (
                  <Badge key={idx} colorPalette="orange" variant="subtle">
                    {String(factor).replace(/_/g, " ")}
                  </Badge>
                ))}
              </Flex>
            </Box>
          )}

        <Separator borderColor="whiteAlpha.200" />

        {/* Causal Chain */}
        <Box>
          <Heading size="sm" mb={2} color="gray.100">
            Causal Chain
          </Heading>
          {loading ? (
            <Flex justify="center" py={4}>
              <Spinner size="sm" color="cyan.400" />
            </Flex>
          ) : causalChain ? (
            <VStack gap={2} align="stretch">
              {/* Causes */}
              {causalChain.causes && causalChain.causes.length > 0 && (
                <Box>
                  <Text fontSize="xs" color="gray.400" mb={1}>
                    原因 ({causalChain.causes.length})
                  </Text>
                  {causalChain.causes.map((cause) => (
                    <DecisionCard
                      key={cause.id}
                      decision={cause}
                      onClick={() => onDecisionSelect(cause)}
                      direction="cause"
                    />
                  ))}
                </Box>
              )}

              {/* Effects */}
              {causalChain.effects && causalChain.effects.length > 0 && (
                <Box>
                  <Text fontSize="xs" color="gray.400" mb={1}>
                    结果 ({causalChain.effects.length})
                  </Text>
                  {causalChain.effects.map((effect) => (
                    <DecisionCard
                      key={effect.id}
                      decision={effect}
                      onClick={() => onDecisionSelect(effect)}
                      direction="effect"
                    />
                  ))}
                </Box>
              )}

              {(!causalChain.causes || causalChain.causes.length === 0) &&
                (!causalChain.effects || causalChain.effects.length === 0) && (
                  <Text fontSize="sm" color="gray.400">
                    未找到因果关系。
                  </Text>
                )}
            </VStack>
          ) : (
            <Text fontSize="sm" color="gray.400">
              No causal chain data.
            </Text>
          )}
        </Box>

        <Separator borderColor="whiteAlpha.200" />

        {/* Similar Decisions */}
        <Box>
          <Heading size="sm" mb={2} color="gray.100">
            相似决策
          </Heading>
          {loading ? (
            <Flex justify="center" py={4}>
              <Spinner size="sm" color="cyan.400" />
            </Flex>
          ) : similarDecisions.length > 0 ? (
            <VStack gap={2} align="stretch">
              {similarDecisions.map((similar) => (
                <SimilarDecisionCard
                  key={similar.decision.id}
                  similarDecision={similar}
                  onClick={() => onDecisionSelect(similar.decision)}
                />
              ))}
            </VStack>
          ) : (
            <Text fontSize="sm" color="gray.400">
              未找到相似决策。
            </Text>
          )}
        </Box>
      </VStack>
    </Box>
  );
}

// Recent decision card for the list view
function RecentDecisionCard({
  decision,
  onClick,
}: {
  decision: Decision;
  onClick: () => void;
}) {
  const typeColor = DECISION_TYPE_COLORS[decision.decision_type] || "gray";
  const categoryColor = CATEGORY_COLORS[decision.category] || "gray";

  return (
    <Box
      bg="gray.800"
      p={3}
      borderRadius="md"
      cursor="pointer"
      _hover={{ bg: "gray.700" }}
      onClick={onClick}
      borderLeftWidth="3px"
      borderLeftColor={`${typeColor}.500`}
      borderWidth="1px"
      borderColor="whiteAlpha.100"
    >
      <HStack justify="space-between" mb={1} flexWrap="wrap" gap={1}>
        <HStack gap={1}>
          <Badge size="sm" colorPalette={typeColor}>
            {decision.decision_type}
          </Badge>
          <Badge size="sm" colorPalette={categoryColor} variant="outline">
            {decision.category}
          </Badge>
        </HStack>
        {(decision.confidence ?? decision.confidence_score) && (
          <Text fontSize="xs" color="gray.400">
            {(
              (decision.confidence ?? decision.confidence_score ?? 0) * 100
            ).toFixed(0)}
            % conf
          </Text>
        )}
      </HStack>
      <Text fontSize="sm" color="gray.200" lineClamp={2}>
        {decision.reasoning?.slice(0, 120) || "无推理"}
        {decision.reasoning && decision.reasoning.length > 120 ? "..." : ""}
      </Text>
      <HStack justify="space-between" mt={2}>
        <Text fontSize="xs" color="gray.500">
          {decision.timestamp
            ? new Date(decision.timestamp).toLocaleDateString()
            : ""}
        </Text>
        {Array.isArray(decision.risk_factors) &&
          decision.risk_factors.length > 0 && (
            <Badge size="sm" colorPalette="orange" variant="subtle">
              {decision.risk_factors.length} risk factors
            </Badge>
          )}
      </HStack>
    </Box>
  );
}

// Decision card for causal chain
function DecisionCard({
  decision,
  onClick,
  direction,
}: {
  decision: Decision;
  onClick: () => void;
  direction: "cause" | "effect";
}) {
  const typeColor = DECISION_TYPE_COLORS[decision.decision_type] || "gray";
  const arrow = direction === "cause" ? "^" : "v";

  return (
    <Box
      bg="gray.800"
      p={2}
      borderRadius="md"
      cursor="pointer"
      _hover={{ bg: "gray.700" }}
      onClick={onClick}
      mb={1}
      borderWidth="1px"
      borderColor="whiteAlpha.100"
    >
      <HStack gap={2}>
        <Text color={direction === "cause" ? "blue.400" : "green.400"}>
          {arrow}
        </Text>
        <Badge size="sm" colorPalette={typeColor}>
          {decision.decision_type.replace(/_/g, " ")}
        </Badge>
        <Text fontSize="xs" color="gray.300" flex={1} truncate>
          {decision.category}
        </Text>
      </HStack>
    </Box>
  );
}

// Similar decision card with similarity score
function SimilarDecisionCard({
  similarDecision,
  onClick,
}: {
  similarDecision: SimilarDecision;
  onClick: () => void;
}) {
  const { decision, similarity_score, similarity_type } = similarDecision;
  const typeColor = DECISION_TYPE_COLORS[decision.decision_type] || "gray";

  return (
    <Box
      bg="gray.800"
      p={3}
      borderRadius="md"
      cursor="pointer"
      _hover={{ bg: "gray.700" }}
      onClick={onClick}
      borderWidth="1px"
      borderColor="whiteAlpha.100"
    >
      <HStack justify="space-between" mb={1}>
        <Badge size="sm" colorPalette={typeColor}>
          {decision.decision_type.replace(/_/g, " ")}
        </Badge>
        <HStack gap={1}>
          <Badge size="sm" variant="outline">
            {similarity_type}
          </Badge>
          <Text fontSize="xs" fontWeight="bold" color="cyan.400">
            {(similarity_score * 100).toFixed(0)}%
          </Text>
        </HStack>
      </HStack>
      <Text fontSize="sm" color="gray.200" lineClamp={2}>
        {decision.reasoning?.slice(0, 150) || "无推理"}...
      </Text>
      <Text fontSize="xs" color="gray.500" mt={1}>
        {(decision.timestamp ?? decision.decision_timestamp)
          ? new Date(
              decision.timestamp ?? decision.decision_timestamp ?? "",
            ).toLocaleDateString()
          : ""}
      </Text>
    </Box>
  );
}
