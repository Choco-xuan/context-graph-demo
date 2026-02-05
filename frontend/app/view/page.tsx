"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Flex,
  Heading,
  IconButton,
  Text,
  Spinner,
} from "@chakra-ui/react";
import { LuPlus, LuMinus, LuChartBar, LuPanelRightClose, LuMessageCircle } from "react-icons/lu";
import dynamic from "next/dynamic";
import { FloatingAIAssistant } from "@/components/FloatingAIAssistant";
import { DecisionTracePanel } from "@/components/DecisionTracePanel";
import {
  getGraphData,
  getFlow,
  type Decision,
  type Flow,
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

function ViewFlowContent() {
  const searchParams = useSearchParams();
  const uuid = searchParams.get("uuid");

  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [graphDecisions, setGraphDecisions] = useState<Decision[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [insightFilter, setInsightFilter] = useState<{
    label?: string;
    relType?: string;
  } | null>(null);
  const graphRef = useRef<ContextGraphViewRef | null>(null);

  useEffect(() => {
    if (!uuid) {
      setError("请提供 uuid 参数，例如：/view?uuid=xxxx");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getFlow(uuid)
      .then((f) => {
        setFlow(f);
        setError(null);
      })
      .catch(() => {
        setFlow(null);
        setError("流程不存在或加载失败");
      })
      .finally(() => setLoading(false));
  }, [uuid]);

  useEffect(() => {
    if (!flow) return;
    getGraphData(undefined, 2, undefined, 0).then(setGraphData).catch(() => {});
  }, [flow]);

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

  if (loading) {
    return (
      <Box
        h="100vh"
        w="100vw"
        bg="#0a0e17"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        gap={4}
      >
        <Spinner size="xl" color="blue.400" />
        <Text color="gray.400">加载流程中…</Text>
      </Box>
    );
  }

  if (error || !flow) {
    return (
      <Box
        h="100vh"
        w="100vw"
        bg="#0a0e17"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        gap={4}
      >
        <Text color="red.300">{error}</Text>
      </Box>
    );
  }

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
      {/* 顶栏：流程名称 */}
      <Flex
        px={4}
        py={2}
        align="center"
        bg="blackAlpha.400"
        borderBottomWidth="1px"
        borderColor="whiteAlpha.200"
        flexShrink={0}
      >
        <Heading size="sm" color="gray.100" truncate>
          {flow.name}
        </Heading>
      </Flex>

      <Flex flex={1} minH={0} w="100%" direction="row">
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

      <FloatingAIAssistant
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        conversationHistory={conversationHistory}
        onConversationUpdate={setConversationHistory}
        onDecisionSelect={handleDecisionSelect}
        onGraphUpdate={handleGraphUpdate}
        decisionTraceOpen={drawerOpen}
        decisionTraceWidth={DRAWER_WIDTH}
        flowId={flow.id}
      />
    </Box>
  );
}

export default function ViewFlowPage() {
  return (
    <Suspense
      fallback={
        <Box
          h="100vh"
          w="100vw"
          bg="#0a0e17"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexDirection="column"
          gap={4}
        >
          <Spinner size="xl" color="blue.400" />
          <Text color="gray.400">加载页面…</Text>
        </Box>
      }
    >
      <ViewFlowContent />
    </Suspense>
  );
}
