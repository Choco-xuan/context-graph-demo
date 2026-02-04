"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Input,
  Textarea,
  Checkbox,
  VStack,
  HStack,
} from "@chakra-ui/react";
import {
  getGraphSources,
  createFlow,
  updateFlow,
  publishFlow,
  type GraphSource,
  type FlowCreatePayload,
  type Flow,
} from "@/lib/api";

const FLOW_TOOLS = [
  "get_schema",
  "explore_nodes",
  "search_nodes",
  "find_paths",
  "analyze_patterns",
  "execute_cypher",
];

const FLOW_MODELS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "deepseek-chat", name: "DeepSeek Chat" },
];

const STEPS = [
  { step: 1, title: "选择图谱数据" },
  { step: 2, title: "配置提示词" },
  { step: 3, title: "配置 Tools" },
  { step: 4, title: "配置模型" },
];

export default function CreateFlowPage() {
  const [step, setStep] = useState(1);
  const [sources, setSources] = useState<GraphSource[]>([]);
  const [name, setName] = useState("");
  const [graphSourceId, setGraphSourceId] = useState("default");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [enabledTools, setEnabledTools] = useState<string[]>(() => [...FLOW_TOOLS]);
  const [modelId, setModelId] = useState("claude-sonnet-4-20250514");
  const [draftFlow, setDraftFlow] = useState<Flow | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    description?: string;
    type: "info" | "success" | "error";
  } | null>(null);

  const showNotification = useCallback(
    (message: string, type: "info" | "success" | "error", description?: string) => {
      setNotification({ message, description, type });
      const ms = type === "error" ? 5000 : 3000;
      setTimeout(() => setNotification(null), ms);
    },
    [],
  );

  useEffect(() => {
    getGraphSources().then(setSources).catch(() => setSources([]));
  }, []);

  const payload: FlowCreatePayload = {
    name: name || "未命名流程",
    graph_source_id: graphSourceId,
    system_prompt: systemPrompt.trim() || undefined,
    enabled_tools: enabledTools,
    model_id: modelId,
  };

  const handleToggleTool = (tool: string) => {
    setEnabledTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      let flow: Flow = draftFlow!;
      if (!flow?.id) {
        flow = await createFlow(payload);
        setDraftFlow(flow);
      } else {
        flow = await updateFlow(flow.id, payload);
        setDraftFlow(flow);
      }
      flow = await publishFlow(flow.id);
      setDraftFlow(flow);
      // 发布成功后跳回列表页（首页）
      window.location.href = "/";
    } catch (e: unknown) {
      showNotification(
        "发布失败",
        "error",
        e instanceof Error ? e.message : String(e),
      );
      setPublishing(false);
    }
  };

  return (
    <Box minH="100vh" bg="#0a0e17" color="gray.100" p={6}>
      {notification && (
        <Box
          mb={4}
          px={4}
          py={3}
          borderRadius="md"
          bg={
            notification.type === "error"
              ? "red.900"
              : notification.type === "success"
                ? "green.900"
                : "blue.900"
          }
          color="white"
          borderWidth="1px"
          borderColor={
            notification.type === "error"
              ? "red.600"
              : notification.type === "success"
                ? "green.600"
                : "blue.600"
          }
        >
          <Text fontWeight="medium">{notification.message}</Text>
          {notification.description && (
            <Text fontSize="sm" opacity={0.9} mt={1}>
              {notification.description}
            </Text>
          )}
        </Box>
      )}
      <Flex justify="space-between" align="center" mb={8}>
        <Heading size="lg">创建洞察</Heading>
      </Flex>

      {/* 步骤指示 */}
      <HStack gap={4} mb={8} flexWrap="wrap">
        {STEPS.map((s) => (
          <Button
            key={s.step}
            size="sm"
            colorScheme={step === s.step ? "blue" : "gray"}
            variant={step === s.step ? "solid" : "outline"}
            onClick={() => setStep(s.step)}
          >
            {s.step}. {s.title}
          </Button>
        ))}
      </HStack>

      <Box bg="whiteAlpha.100" borderWidth="1px" borderColor="whiteAlpha.200" p={6} borderRadius="lg">
          {/* Step 1: 选择图谱数据 */}
          {step === 1 && (
            <VStack align="stretch" gap={4}>
              <Text fontWeight="medium">洞察名称</Text>
              <Input
                placeholder="例如：管线图谱问答"
                value={name}
                onChange={(e) => setName(e.target.value)}
                bg="whiteAlpha.50"
              />
              <Text fontWeight="medium">选择图谱数据源</Text>
              <VStack align="stretch">
                {sources.length === 0 && (
                  <Text color="gray.400">加载中或暂无数据源…</Text>
                )}
                {sources.map((src) => (
                  <Box
                    key={src.id}
                    p={3}
                    borderRadius="md"
                    bg={graphSourceId === src.id ? "blue.900" : "whiteAlpha.50"}
                    cursor="pointer"
                    onClick={() => setGraphSourceId(src.id)}
                    borderWidth="1px"
                    borderColor={graphSourceId === src.id ? "blue.500" : "transparent"}
                  >
                    <Text fontWeight="medium">{src.name}</Text>
                    {src.description && (
                      <Text fontSize="sm" color="gray.400">
                        {src.description}
                      </Text>
                    )}
                  </Box>
                ))}
              </VStack>
            </VStack>
          )}

          {/* Step 2: 配置提示词 */}
          {step === 2 && (
            <VStack align="stretch" gap={4}>
              <Text fontWeight="medium">系统提示词（可选）</Text>
              <Text fontSize="sm" color="gray.400">
                留空则使用基于当前图谱 schema 的默认提示；填写则完全替换默认提示。
              </Text>
              <Textarea
                placeholder="例如：你是一个专注于管线图谱的助手，只回答与节点、关系、路径相关的问题…"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={10}
                bg="whiteAlpha.50"
              />
            </VStack>
          )}

          {/* Step 3: 配置 Tools */}
          {step === 3 && (
            <VStack align="stretch" gap={4}>
              <Text fontWeight="medium">启用的工具</Text>
              <Text fontSize="sm" color="gray.400">
                勾选该流程中 AI 可调用的图谱工具。
              </Text>
              <VStack align="stretch" gap={2}>
                {FLOW_TOOLS.map((tool) => (
                  <Checkbox.Root
                    key={tool}
                    checked={enabledTools.includes(tool)}
                    onCheckedChange={() => handleToggleTool(tool)}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>{tool}</Checkbox.Label>
                  </Checkbox.Root>
                ))}
              </VStack>
            </VStack>
          )}

          {/* Step 4: 配置模型 */}
          {step === 4 && (
            <VStack align="stretch" gap={4}>
              <Text fontWeight="medium">模型</Text>
              <HStack flexWrap="wrap" gap={2}>
                {FLOW_MODELS.map((m) => (
                  <Button
                    key={m.id}
                    size="sm"
                    colorScheme={modelId === m.id ? "blue" : "gray"}
                    variant={modelId === m.id ? "solid" : "outline"}
                    onClick={() => setModelId(m.id)}
                  >
                    {m.name}
                  </Button>
                ))}
              </HStack>
            </VStack>
          )}

          {/* 上一步 / 下一步 */}
          <Flex justify={step === 1 ? "flex-end" : "space-between"} mt={8}>
            {step > 1 && (
              <Button
                onClick={() => setStep((s) => s - 1)}
                variant="outline"
              >
                上一步
              </Button>
            )}
            {step < 4 ? (
              <Button colorScheme="blue" onClick={() => setStep((s) => s + 1)}>
                下一步
              </Button>
            ) : (
              <Button
                loading={publishing}
                colorScheme="green"
                onClick={handlePublish}
              >
                发布
              </Button>
            )}
          </Flex>
      </Box>
    </Box>
  );
}
