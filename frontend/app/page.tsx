"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Box, Flex, Heading, IconButton } from "@chakra-ui/react";
import { LuPlus, LuMinus, LuChartBar, LuPanelRightClose, LuMessageCircle } from "react-icons/lu";
import dynamic from "next/dynamic";
import { FloatingAIAssistant } from "@/components/FloatingAIAssistant";
import { DecisionTracePanel } from "@/components/DecisionTracePanel";
import {
  getGraphData,
  type Decision,
  type GraphData,
  type GraphNode,
  type ChatMessage,
} from "@/lib/api";

function graphNodeToDecision(node: GraphNode): Decision {
  const props = node.properties;
  return {
    id: (props.id as string) || node.id,
    decision_type: (props.decision_type as string) || "unknown",
    category: (props.category as string) || "unknown",
    reasoning: (props.reasoning as string) || "",
    reasoning_summary: props.reasoning_summary as string | undefined,
    confidence_score: props.confidence_score as number | undefined,
    risk_factors: (props.risk_factors as string[]) || [],
    status: (props.status as string) || "unknown",
    decision_timestamp: props.decision_timestamp as string | undefined,
    timestamp: props.decision_timestamp as string | undefined,
  };
}

const ContextGraphView = dynamic(
  () =>
    import("@/components/ContextGraphView").then((mod) => mod.ContextGraphView),
  { ssr: false },
);

type ContextGraphViewRef = { zoomIn: () => void; zoomOut: () => void };

const DRAWER_WIDTH = 380;

export default function Home() {
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(
    null,
  );
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [graphDecisions, setGraphDecisions] = useState<Decision[]>([]);
  const [conversationHistory, setConversationHistory] = useState<
    ChatMessage[]
  >([]);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [insightFilter, setInsightFilter] = useState<{
    label?: string;
    relType?: string;
  } | null>(null);
  const graphRef = useRef<ContextGraphViewRef | null>(null);

  useEffect(() => {
    getGraphData(undefined, 2, undefined, 0)
      .then(setGraphData)
      .catch(() => {});
  }, []);

  // 图谱数据更新时清除洞察筛选，避免筛选条件与数据不匹配
  useEffect(() => {
    setInsightFilter(null);
  }, [graphData]);

  const handleDecisionSelect = useCallback((decision: Decision) => {
    setSelectedDecision(decision);
    setDrawerOpen(true);
  }, []);

  const handleGraphUpdate = useCallback((data: GraphData) => {
    setGraphData(data);
  }, []);

  const handleDecisionNodesChange = useCallback(
    (decisionNodes: GraphNode[]) => {
      setGraphDecisions(decisionNodes.map(graphNodeToDecision));
    },
    [],
  );

  const handleDecisionNodeClick = useCallback((node: GraphNode) => {
    setSelectedDecision(graphNodeToDecision(node));
    setDrawerOpen(true);
  }, []);

  return (
    <Box
      h="100vh"
      minH={0}
      w="100vw"
      overflow="hidden"
      bg="#0a0e17"
      display="flex"
      flexDirection="column"
    >
      {/* 图谱 | 决策追溯（AI 智能助手悬浮，紧挨决策追溯） */}
      <Flex flex={1} minH={0} w="100%" direction="row">
        {/* 图谱区域（占满剩余宽度） */}
        <Box flex={1} minH={0} minW={0} position="relative" overflow="hidden">
          <Box position="absolute" inset={0} zIndex={0}>
            <ContextGraphView
              innerRef={graphRef}
              graphData={graphData}
              onNodeClick={() => {}}
              onDecisionNodesChange={handleDecisionNodesChange}
              onDecisionNodeClick={handleDecisionNodeClick}
              selectedNodeId={selectedDecision?.id}
              height="100%"
              showLegend={true}
              highlightLabel={insightFilter?.label ?? null}
              highlightRelType={insightFilter?.relType ?? null}
            />
          </Box>

          {/* 左下角 - 缩放控制（圆形按钮） */}
          <Flex
            position="absolute"
            bottom={6}
            left={6}
            zIndex={10}
            gap={2}
            align="center"
            p={1}
            borderRadius="full"
            bg="blackAlpha.400"
            borderWidth="1px"
            borderColor="whiteAlpha.200"
            backdropFilter="blur(8px)"
          >
            <IconButton
              aria-label="缩小"
              size="lg"
              borderRadius="full"
              bg="whiteAlpha.100"
              color="white"
              borderWidth="1px"
              borderColor="whiteAlpha.200"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => graphRef.current?.zoomOut()}
            >
              <LuMinus />
            </IconButton>
            <IconButton
              aria-label="放大"
              size="lg"
              borderRadius="full"
              bg="whiteAlpha.100"
              color="white"
              borderWidth="1px"
              borderColor="whiteAlpha.200"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => graphRef.current?.zoomIn()}
            >
              <LuPlus />
            </IconButton>
          </Flex>

          {/* 右下角 - 打开 AI 助手 / 打开决策追溯 */}
          <Flex
            position="absolute"
            bottom={6}
            right={6}
            zIndex={10}
            gap={3}
            align="center"
          >
            {!aiAssistantOpen && (
              <IconButton
                aria-label="打开 AI 智能助手"
                size="xl"
                w={12}
                h={12}
                borderRadius="xl"
                bg="green.600"
                color="white"
                borderWidth="1px"
                borderColor="green.500"
                _hover={{ bg: "green.500" }}
                onClick={() => setAiAssistantOpen(true)}
              >
                <LuMessageCircle />
              </IconButton>
            )}
            <IconButton
              aria-label={drawerOpen ? "关闭决策追溯" : "打开决策追溯"}
              size="xl"
              w={12}
              h={12}
              borderRadius="xl"
              bg="orange.500"
              color="white"
              borderWidth="1px"
              borderColor="orange.400"
              _hover={{ bg: "orange.400" }}
              onClick={() => setDrawerOpen((o) => !o)}
            >
              <LuChartBar />
            </IconButton>
          </Flex>
        </Box>

        {/* 决策追溯 - 布局内右侧栏 */}
        <Box
          w={drawerOpen ? DRAWER_WIDTH : 0}
          flexShrink={0}
          overflow="hidden"
          transition="width 0.25s ease-out"
          display="flex"
          flexDirection="column"
          bg="blackAlpha.700"
          backdropFilter="blur(12px)"
          borderLeftWidth={drawerOpen ? "1px" : 0}
          borderColor="whiteAlpha.200"
        >
          <Flex
            align="center"
            justify="space-between"
            px={4}
            py={3}
            borderBottomWidth="1px"
            borderColor="whiteAlpha.100"
            flexShrink={0}
          >
            <Heading size="sm" color="gray.100">
              决策追溯
            </Heading>
            <IconButton
              aria-label="关闭"
              size="sm"
              variant="ghost"
              colorPalette="gray"
              color="gray.400"
              _hover={{ color: "cyan.400" }}
              onClick={() => setDrawerOpen(false)}
            >
              <LuPanelRightClose />
            </IconButton>
          </Flex>
          <Box flex={1} minH={0} overflow="auto">
            <DecisionTracePanel
              decision={selectedDecision}
              onDecisionSelect={handleDecisionSelect}
              graphDecisions={graphDecisions}
              graphData={graphData}
              insightFilter={insightFilter}
              onInsightFilterChange={setInsightFilter}
            />
          </Box>
        </Box>
      </Flex>

      {/* AI 智能助手 - 悬浮，展开位置固定，紧挨决策追溯（在决策追溯左侧） */}
      <FloatingAIAssistant
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        conversationHistory={conversationHistory}
        onConversationUpdate={setConversationHistory}
        onDecisionSelect={handleDecisionSelect}
        onGraphUpdate={handleGraphUpdate}
        decisionTraceOpen={drawerOpen}
        decisionTraceWidth={DRAWER_WIDTH}
      />
    </Box>
  );
}
