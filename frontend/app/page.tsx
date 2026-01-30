"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Container,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import dynamic from "next/dynamic";
import { ChatInterface } from "@/components/ChatInterface";
import { DecisionTracePanel } from "@/components/DecisionTracePanel";
import { getGraphData, type Decision, type GraphData, type GraphNode, type ChatMessage } from "@/lib/api";

// Helper to convert a GraphNode to a Decision object
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

// Dynamic import for NVL to avoid SSR issues
const ContextGraphView = dynamic(
  () =>
    import("@/components/ContextGraphView").then((mod) => mod.ContextGraphView),
  { ssr: false },
);

export default function Home() {
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(
    null,
  );
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [graphDecisions, setGraphDecisions] = useState<Decision[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>(
    [],
  );

  // 页面加载时预拉取图数据，limit=0 表示不限制条数（全部加载）
  useEffect(() => {
    getGraphData(undefined, 2, undefined, 0)
      .then(setGraphData)
      .catch(() => {});
  }, []);

  const handleDecisionSelect = useCallback((decision: Decision) => {
    setSelectedDecision(decision);
  }, []);

  const handleGraphUpdate = useCallback((data: GraphData) => {
    setGraphData(data);
  }, []);

  const handleNodeClick = useCallback((nodeId: string, labels: string[]) => {
    console.log("Node clicked:", nodeId, labels);
  }, []);

  // Handle when decision nodes in the graph change
  const handleDecisionNodesChange = useCallback(
    (decisionNodes: GraphNode[]) => {
      const decisions = decisionNodes.map(graphNodeToDecision);
      setGraphDecisions(decisions);
    },
    [],
  );

  // Handle when a decision node is clicked in the graph
  const handleDecisionNodeClick = useCallback((node: GraphNode) => {
    const decision = graphNodeToDecision(node);
    setSelectedDecision(decision);
  }, []);

  return (
    <Box
      h="100vh"
      minH={0}
      bg="bg.canvas"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* Header */}
      <Box
        as="header"
        flexShrink={0}
        bg="bg.surface"
        borderBottomWidth="1px"
        borderColor="border.default"
        py={{ base: 2, md: 3 }}
        px={{ base: 3, md: 4 }}
      >
        <Container maxW="100%" px={{ base: 3, md: 4 }}>
          <Flex justify="space-between" align="center">
            <Flex align="center" gap={3}>
              {/* Neo4j Logo */}
              <a
                href="https://neo4j.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Box
                  width={{ base: "32px", md: "40px" }}
                  height={{ base: "32px", md: "40px" }}
                  flexShrink={0}
                >
                  <svg viewBox="0 0 100 100" width="100%" height="100%">
                    <circle cx="50" cy="50" r="48" fill="#018BFF" />
                    <g fill="white">
                      <circle cx="50" cy="30" r="8" />
                      <circle cx="30" cy="65" r="8" />
                      <circle cx="70" cy="65" r="8" />
                      <line
                        x1="50"
                        y1="38"
                        x2="33"
                        y2="58"
                        stroke="white"
                        strokeWidth="3"
                      />
                      <line
                        x1="50"
                        y1="38"
                        x2="67"
                        y2="58"
                        stroke="white"
                        strokeWidth="3"
                      />
                      <line
                        x1="38"
                        y1="65"
                        x2="62"
                        y2="65"
                        stroke="white"
                        strokeWidth="3"
                      />
                    </g>
                  </svg>
                </Box>
              </a>
              <Box>
                <Heading size={{ base: "md", md: "lg" }} color="brand.600">
                  本体洞察分析
                </Heading>
                <Text
                  color="gray.500"
                  fontSize="sm"
                  display={{ base: "none", md: "block" }}
                >
                  基于本体的智能决策分析
                </Text>
              </Box>
            </Flex>

          </Flex>
        </Container>
      </Box>

      {/* Main Content - 铺满剩余视口 */}
      <Box flex={1} minH={0} display="flex" flexDirection="column" w="100%" overflow="hidden">
        <Box flex={1} minH={0} display="flex" flexDirection="column" w="100%" px={{ base: 2, md: 3 }}>
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 1fr", xl: "1fr 1.5fr 1fr" }}
            gap={{ base: 2, md: 3 }}
            h="100%"
            minH={0}
          >
          {/* Chat Panel */}
          <GridItem overflow="hidden" minH={0}>
            <Box
              bg="bg.surface"
              borderRadius="lg"
              borderWidth="1px"
              borderColor="border.default"
              h="100%"
              display="flex"
              flexDirection="column"
              overflow="hidden"
            >
              <Box
                p={4}
                borderBottomWidth="1px"
                borderColor="border.default"
                flexShrink={0}
              >
                <Heading size="md">AI助手</Heading>
                <Text fontSize="sm" color="gray.500">
                  通过对话探查本体关系
                </Text>
              </Box>
              <Box flex="1" minH={0} overflow="hidden">
                <ChatInterface
                  conversationHistory={conversationHistory}
                  onConversationUpdate={setConversationHistory}
                  onDecisionSelect={handleDecisionSelect}
                  onGraphUpdate={handleGraphUpdate}
                />
              </Box>
            </Box>
          </GridItem>

          {/* Graph Visualization - Hidden on mobile */}
          <GridItem display={{ base: "none", lg: "block" }} overflow="hidden" minH={0}>
            <Box
              bg="bg.surface"
              borderRadius="lg"
              borderWidth="1px"
              borderColor="border.default"
              h="100%"
              display="flex"
              flexDirection="column"
              overflow="hidden"
            >
              <Box
                p={4}
                borderBottomWidth="1px"
                borderColor="border.default"
                flexShrink={0}
              >
                <Heading size="md">图谱可视化</Heading>
                <Text fontSize="sm" color="gray.500">
                  本体实体、决策与因果关系可视化
                </Text>
              </Box>
              <Box flex="1" minH={0}>
                <ContextGraphView
                  graphData={graphData}
                  onNodeClick={handleNodeClick}
                  onDecisionNodesChange={handleDecisionNodesChange}
                  onDecisionNodeClick={handleDecisionNodeClick}
                  selectedNodeId={selectedDecision?.id}
                />
              </Box>
            </Box>
          </GridItem>

          {/* Decision Trace Panel */}
          <GridItem display={{ base: "none", xl: "block" }} overflow="hidden" minH={0}>
            <Box
              bg="bg.surface"
              borderRadius="lg"
              borderWidth="1px"
              borderColor="border.default"
              h="100%"
              display="flex"
              flexDirection="column"
              overflow="hidden"
            >
              <Box
                p={4}
                borderBottomWidth="1px"
                borderColor="border.default"
                flexShrink={0}
              >
                <Heading size="md">决策追溯</Heading>
                <Text fontSize="sm" color="gray.500">
                  查看推理、先例与因果链
                </Text>
              </Box>
              <Box flex="1" minH={0} overflow="auto">
                <DecisionTracePanel
                  decision={selectedDecision}
                  onDecisionSelect={handleDecisionSelect}
                  graphDecisions={graphDecisions}
                />
              </Box>
            </Box>
          </GridItem>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}
