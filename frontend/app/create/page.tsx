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
import { LuDatabase, LuCheck, LuChevronRight } from "react-icons/lu";
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
    <Box
      minH="100vh"
      bg="#0a0e17"
      color="gray.100"
      display="flex"
      alignItems="center"
      justifyContent="center"
      py={12}
      px={4}
    >
      {notification && (
        <Box
          position="fixed"
          top={4}
          left="50%"
          transform="translateX(-50%)"
          zIndex={100}
          px={4}
          py={3}
          borderRadius="lg"
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
          boxShadow="xl"
        >
          <Text fontWeight="medium">{notification.message}</Text>
          {notification.description && (
            <Text fontSize="sm" opacity={0.9} mt={1}>
              {notification.description}
            </Text>
          )}
        </Box>
      )}

      {/* 居中容器 */}
      <Box w="100%" maxW="800px">
        <Heading size="xl" mb={12} textAlign="center" fontWeight="600" color="gray.50">
          创建洞察
        </Heading>

        {/* 极简线条风格步骤条 */}
        <Box position="relative" mb={12} py={4}>
          {/* 步骤圆圈、连接线和箭头 */}
          <Flex align="center" justify="center" position="relative" gap={0}>
            {STEPS.map((s, index) => {
              const isCompleted = step > s.step;
              const isCurrent = step === s.step;
              const isLast = index === STEPS.length - 1;
              
              // 计算连接线状态：如果当前步骤大于当前节点步骤，则连接线已完成
              const lineCompleted = step > s.step;
              
              return (
                <Flex 
                  key={s.step} 
                  align="center" 
                  flex={isLast ? "0 0 auto" : "1"} 
                  position="relative"
                  minW={isLast ? "auto" : "0"}
                >
                  {/* 步骤圆圈和标题容器 */}
                  <Flex 
                    direction="column" 
                    align="center" 
                    gap={3} 
                    position="relative" 
                    zIndex={3}
                    flexShrink={0}
                  >
                    {/* 步骤圆圈 */}
                    <Box 
                      position="relative" 
                      display="flex" 
                      alignItems="center" 
                      justifyContent="center"
                      w={8}
                      h={8}
                    >
                      {/* 当前步骤的外层光晕轮廓 */}
                      {isCurrent && (
                        <Box
                          position="absolute"
                          top="-4px"
                          left="-4px"
                          w="40px"
                          h="40px"
                          borderRadius="full"
                          borderWidth="2px"
                          borderColor="rgba(59, 130, 246, 0.4)"
                          boxShadow="0 0 0 2px rgba(59, 130, 246, 0.2), 0 0 12px rgba(59, 130, 246, 0.3)"
                          transition="all 0.3s ease"
                        />
                      )}
                      {/* 内层实心圆 */}
                      <Flex
                        align="center"
                        justify="center"
                        w={8}
                        h={8}
                        borderRadius="full"
                        bg={
                          isCompleted
                            ? "#3b82f6"
                            : isCurrent
                            ? "#3b82f6"
                            : "#374151"
                        }
                        color="white"
                        fontWeight="600"
                        fontSize="sm"
                        cursor="pointer"
                        onClick={() => setStep(s.step)}
                        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                        boxShadow={
                          isCompleted
                            ? "0 2px 8px rgba(59, 130, 246, 0.3)"
                            : isCurrent
                            ? "0 2px 8px rgba(59, 130, 246, 0.3)"
                            : "none"
                        }
                        _hover={{
                          transform: "scale(1.1)",
                          boxShadow: isCompleted || isCurrent
                            ? "0 4px 12px rgba(59, 130, 246, 0.4)"
                            : "0 2px 8px rgba(156, 163, 175, 0.2)",
                        }}
                      >
                        {isCompleted ? (
                          <LuCheck size={16} />
                        ) : (
                          <Text fontSize="sm" fontWeight="600">
                            {s.step}
                          </Text>
                        )}
                      </Flex>
                    </Box>
                    {/* 步骤标题 */}
                    <Text
                      fontSize="xs"
                      color={
                        isCurrent
                          ? "#60a5fa"
                          : isCompleted
                          ? "#94a3b8"
                          : "#94a3b8"
                      }
                      fontWeight="500"
                      whiteSpace="nowrap"
                      transition="all 0.3s ease"
                      textAlign="center"
                      maxW="120px"
                    >
                      {s.title}
                    </Text>
                  </Flex>
                  
                  {/* 连接线和箭头（不在最后一个节点后显示） */}
                  {!isLast && (
                    <Box
                      flex="1"
                      position="relative"
                      mx={2}
                      minW="60px"
                      h={8}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      style={{
                        marginTop: '-24px' // 向上移动，使连接线中心对齐圆圈中心
                      }}
                    >
                      {/* 背景横线（未完成部分） */}
                      <Box
                        position="absolute"
                        top="50%"
                        left="0"
                        right="0"
                        h="2px"
                        bg="#374151"
                        borderRadius="full"
                        transform="translateY(-50%)"
                        zIndex={1}
                      />
                      {/* 已完成部分的蓝色进度条 */}
                      <Box
                        position="absolute"
                        top="50%"
                        left="0"
                        h="2px"
                        bg="#3b82f6"
                        borderRadius="full"
                        transform="translateY(-50%)"
                        zIndex={2}
                        transition="width 0.6s cubic-bezier(0.4, 0, 0.2, 1)"
                        style={{
                          width: lineCompleted ? '100%' : '0%'
                        }}
                      />
                      {/* 箭头图标 */}
                      <Box
                        position="relative"
                        zIndex={3}
                        color={lineCompleted ? "#3b82f6" : "#374151"}
                        transition="color 0.3s ease"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bg="#0a0e17"
                        px={1}
                        borderRadius="sm"
                      >
                        <LuChevronRight size={16} />
                      </Box>
                    </Box>
                  )}
                </Flex>
              );
            })}
          </Flex>
        </Box>

        {/* 主内容卡片 */}
        <Box
          bg="rgba(255, 255, 255, 0.03)"
          backdropFilter="blur(20px)"
          borderWidth="1px"
          borderColor="rgba(255, 255, 255, 0.1)"
          p={8}
          borderRadius="2xl"
          boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
          w="100%"
          overflow="visible"
        >
          {/* Step 1: 选择图谱数据 */}
          {step === 1 && (
            <VStack align="stretch" gap={6}>
              <Box>
                <Text fontSize="sm" color="gray.400" mb={2} fontWeight="500">
                  洞察名称
                </Text>
                <Input
                  placeholder="例如：管线图谱问答"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  bg="rgba(255, 255, 255, 0.05)"
                  borderWidth="1px"
                  borderColor="rgba(255, 255, 255, 0.1)"
                  color="gray.50"
                  fontSize="md"
                  h={12}
                  _hover={{
                    borderColor: "rgba(59, 130, 246, 0.5)",
                    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                  }}
                  _focus={{
                    borderColor: "blue.500",
                    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.2)",
                    bg: "rgba(255, 255, 255, 0.07)",
                  }}
                  transition="all 0.2s ease"
                  _placeholder={{
                    color: "gray.500",
                  }}
                />
              </Box>
              <Box>
                <Text fontSize="sm" color="gray.400" mb={4} fontWeight="500">
                  选择图谱数据源
                </Text>
                <VStack align="stretch" gap={3}>
                  {sources.length === 0 && (
                    <Text color="gray.500" fontSize="sm">加载中或暂无数据源…</Text>
                  )}
                  {sources.map((src) => (
                    <Box
                      key={src.id}
                      p={4}
                      borderRadius="xl"
                      bg={
                        graphSourceId === src.id
                          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)"
                          : "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)"
                      }
                      borderWidth="1px"
                      borderColor={
                        graphSourceId === src.id
                          ? "rgba(59, 130, 246, 0.4)"
                          : "rgba(255, 255, 255, 0.1)"
                      }
                      cursor="pointer"
                      onClick={() => setGraphSourceId(src.id)}
                      transition="all 0.2s ease"
                      _hover={{
                        borderColor: graphSourceId === src.id ? "rgba(59, 130, 246, 0.6)" : "rgba(255, 255, 255, 0.2)",
                        transform: "translateY(-1px)",
                        boxShadow: graphSourceId === src.id
                          ? "0 4px 12px rgba(59, 130, 246, 0.2)"
                          : "0 4px 12px rgba(0, 0, 0, 0.2)",
                      }}
                      position="relative"
                      overflow="hidden"
                    >
                      {graphSourceId === src.id && (
                        <Box
                          position="absolute"
                          top={0}
                          right={0}
                          w={2}
                          h={2}
                          bg="blue.400"
                          borderRadius="full"
                          boxShadow="0 0 8px rgba(59, 130, 246, 0.6)"
                        />
                      )}
                      <Flex align="center" gap={3}>
                        <Box
                          p={2}
                          borderRadius="lg"
                          bg={graphSourceId === src.id ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.05)"}
                          color={graphSourceId === src.id ? "blue.300" : "gray.400"}
                        >
                          <LuDatabase size={20} />
                        </Box>
                        <Box flex={1}>
                          <Text fontWeight="600" color="gray.50" fontSize="md">
                            {src.name}
                          </Text>
                          {src.description && (
                            <Text fontSize="sm" color="gray.400" mt={1}>
                              {src.description}
                            </Text>
                          )}
                        </Box>
                        {graphSourceId === src.id && (
                          <Box
                            w={5}
                            h={5}
                            borderRadius="full"
                            bg="blue.500"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            flexShrink={0}
                          >
                            <LuCheck size={14} color="white" />
                          </Box>
                        )}
                      </Flex>
                    </Box>
                  ))}
                </VStack>
              </Box>
            </VStack>
          )}

          {/* Step 2: 配置提示词 */}
          {step === 2 && (
            <VStack align="stretch" gap={4}>
              <Box>
                <Text fontSize="sm" color="gray.400" mb={2} fontWeight="500">
                  系统提示词（可选）
                </Text>
                <Text fontSize="xs" color="gray.500" mb={4}>
                  留空则使用基于当前图谱 schema 的默认提示；填写则完全替换默认提示。
                </Text>
                <Textarea
                  placeholder="例如：你是一个专注于管线图谱的助手，只回答与节点、关系、路径相关的问题…"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={10}
                  bg="rgba(255, 255, 255, 0.05)"
                  borderWidth="1px"
                  borderColor="rgba(255, 255, 255, 0.1)"
                  color="gray.50"
                  _hover={{
                    borderColor: "rgba(59, 130, 246, 0.5)",
                    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                  }}
                  _focus={{
                    borderColor: "blue.500",
                    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.2)",
                    bg: "rgba(255, 255, 255, 0.07)",
                  }}
                  transition="all 0.2s ease"
                  _placeholder={{
                    color: "gray.500",
                  }}
                />
              </Box>
            </VStack>
          )}

          {/* Step 3: 配置 Tools */}
          {step === 3 && (
            <VStack align="stretch" gap={4}>
              <Box>
                <Text fontSize="sm" color="gray.400" mb={2} fontWeight="500">
                  启用的工具
                </Text>
                <Text fontSize="xs" color="gray.500" mb={4}>
                  勾选该流程中 AI 可调用的图谱工具。
                </Text>
                <VStack align="stretch" gap={3}>
                  {FLOW_TOOLS.map((tool) => (
                    <Box
                      key={tool}
                      p={3}
                      borderRadius="lg"
                      bg="rgba(255, 255, 255, 0.03)"
                      borderWidth="1px"
                      borderColor={
                        enabledTools.includes(tool)
                          ? "rgba(59, 130, 246, 0.4)"
                          : "rgba(255, 255, 255, 0.1)"
                      }
                      cursor="pointer"
                      onClick={() => handleToggleTool(tool)}
                      transition="all 0.2s ease"
                      _hover={{
                        bg: "rgba(255, 255, 255, 0.05)",
                        borderColor: "rgba(59, 130, 246, 0.5)",
                      }}
                    >
                      <Checkbox.Root
                        checked={enabledTools.includes(tool)}
                        onCheckedChange={() => handleToggleTool(tool)}
                      >
                        <Checkbox.HiddenInput />
                        <Flex align="center" gap={3}>
                          <Checkbox.Control
                            bg={enabledTools.includes(tool) ? "blue.500" : "transparent"}
                            borderColor={enabledTools.includes(tool) ? "blue.500" : "gray.600"}
                            _checked={{
                              bg: "blue.500",
                              borderColor: "blue.500",
                            }}
                          />
                          <Checkbox.Label
                            color={enabledTools.includes(tool) ? "gray.50" : "gray.400"}
                            fontWeight={enabledTools.includes(tool) ? "500" : "400"}
                            cursor="pointer"
                          >
                            {tool}
                          </Checkbox.Label>
                        </Flex>
                      </Checkbox.Root>
                    </Box>
                  ))}
                </VStack>
              </Box>
            </VStack>
          )}

          {/* Step 4: 配置模型 */}
          {step === 4 && (
            <VStack align="stretch" gap={4}>
              <Box>
                <Text fontSize="sm" color="gray.400" mb={4} fontWeight="500">
                  模型
                </Text>
                <HStack flexWrap="wrap" gap={3}>
                  {FLOW_MODELS.map((m) => (
                    <Button
                      key={m.id}
                      size="md"
                      bg={
                        modelId === m.id
                          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)"
                          : "rgba(255, 255, 255, 0.05)"
                      }
                      borderWidth="1px"
                      borderColor={
                        modelId === m.id
                          ? "rgba(59, 130, 246, 0.5)"
                          : "rgba(255, 255, 255, 0.1)"
                      }
                      color={modelId === m.id ? "blue.300" : "gray.400"}
                      fontWeight={modelId === m.id ? "600" : "400"}
                      _hover={{
                        bg: modelId === m.id
                          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(59, 130, 246, 0.15) 100%)"
                          : "rgba(255, 255, 255, 0.08)",
                        borderColor: modelId === m.id ? "rgba(59, 130, 246, 0.6)" : "rgba(255, 255, 255, 0.2)",
                        transform: "translateY(-1px)",
                      }}
                      onClick={() => setModelId(m.id)}
                      transition="all 0.2s ease"
                      px={6}
                      py={3}
                    >
                      {m.name}
                    </Button>
                  ))}
                </HStack>
              </Box>
            </VStack>
          )}

          {/* 上一步 / 下一步 */}
          <Box
            mt={10}
            pt={6}
            borderTopWidth="1px"
            borderColor="rgba(255, 255, 255, 0.1)"
            w="100%"
          >
            <Flex
              justify={step === 1 ? "flex-end" : "space-between"}
              align="center"
              gap={4}
              w="100%"
            >
              {step > 1 && (
                <Button
                  onClick={() => setStep((s) => s - 1)}
                  variant="ghost"
                  color="gray.400"
                  _hover={{
                    bg: "rgba(255, 255, 255, 0.05)",
                    color: "gray.300",
                  }}
                  transition="all 0.2s ease"
                  flexShrink={0}
                >
                  上一步
                </Button>
              )}
              {step < 4 ? (
                <Button
                  bg="blue.500"
                  color="white"
                  fontWeight="600"
                  px={5}
                  py={3}
                  h="auto"
                  fontSize="sm"
                  borderRadius="lg"
                  _hover={{
                    bg: "blue.400",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
                  }}
                  _active={{
                    transform: "translateY(0)",
                  }}
                  onClick={() => setStep((s) => s + 1)}
                  transition="all 0.2s ease"
                  flexShrink={0}
                >
                  下一步
                </Button>
              ) : (
                <Button
                  loading={publishing}
                  bg="green.500"
                  color="white"
                  fontWeight="600"
                  px={5}
                  py={3}
                  h="auto"
                  fontSize="sm"
                  borderRadius="lg"
                  _hover={{
                    bg: "green.400",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(34, 197, 94, 0.4)",
                  }}
                  _active={{
                    transform: "translateY(0)",
                  }}
                  onClick={handlePublish}
                  transition="all 0.2s ease"
                  flexShrink={0}
                >
                  发布
                </Button>
              )}
            </Flex>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
