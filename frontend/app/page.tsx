"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Flex, Heading, Text, Spinner, SimpleGrid, Badge } from "@chakra-ui/react";
import NextLink from "next/link";
import { LuTrash2, LuPlus, LuArrowRight, LuWrench, LuSparkles } from "react-icons/lu";
import { listFlows, deleteFlow, type Flow } from "@/lib/api";

export default function Home() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listFlows(true)
      .then(setFlows)
      .catch(() => setError("加载列表失败"))
      .finally(() => setLoading(false));
  }, []);

  const viewUrl = (id: string) => `/view?uuid=${id}`;

  const handleDelete = useCallback(
    async (e: React.MouseEvent, flowId: string, flowName: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm(`确定要删除洞察"${flowName}"吗？此操作不可恢复。`)) {
        return;
      }
      try {
        await deleteFlow(flowId);
        // 删除成功后刷新列表
        setFlows((prev) => prev.filter((f) => f.id !== flowId));
      } catch (err) {
        alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [],
  );

  return (
    <Box minH="100vh" bg="#0a0e17" color="gray.100" py={12} px={4}>
      {/* 居中容器 */}
      <Box maxW="7xl" mx="auto" w="100%">
        <Flex justify="space-between" align="center" mb={8}>
          <Heading size="xl" fontWeight="600" color="gray.50">
            洞察列表
          </Heading>
        </Flex>

        {loading && (
          <Flex justify="center" py={20}>
            <Spinner size="lg" color="blue.400" />
          </Flex>
        )}

        {error && (
          <Box
            p={6}
            borderRadius="lg"
            bg="red.900/20"
            borderWidth="1px"
            borderColor="red.800/50"
          >
            <Text color="red.300">{error}</Text>
          </Box>
        )}

        {!loading && !error && (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
            {/* 创建新洞察卡片 */}
            <NextLink href="/create">
              <Box
                borderRadius="xl"
                bg="rgba(15, 23, 42, 0.5)"
                borderWidth="2px"
                borderStyle="dashed"
                borderColor="rgba(148, 163, 184, 0.3)"
                p={8}
                h="full"
                minH="200px"
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                transition="all 0.3s ease"
                _hover={{
                  borderColor: "rgba(59, 130, 246, 0.5)",
                  bg: "rgba(15, 23, 42, 0.7)",
                  transform: "translateY(-2px)",
                }}
              >
                <Box
                  w={12}
                  h={12}
                  borderRadius="full"
                  bg="rgba(59, 130, 246, 0.1)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  mb={4}
                >
                  <LuPlus size={24} color="#60a5fa" />
                </Box>
                <Text fontSize="md" fontWeight="500" color="gray.300" textAlign="center">
                  创建新洞察
                </Text>
                <Text fontSize="xs" color="gray.500" mt={2} textAlign="center">
                  开始配置你的 AI 洞察流程
                </Text>
              </Box>
            </NextLink>

            {/* 洞察卡片列表 */}
            {flows.map((flow) => (
              <Box
                key={flow.id}
                position="relative"
                borderRadius="xl"
                bg="rgba(15, 23, 42, 0.5)"
                borderWidth="1px"
                borderColor="rgba(30, 41, 59, 1)"
                boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
                transition="all 0.3s ease"
                _hover={{
                  borderColor: "rgba(59, 130, 246, 0.5)",
                  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.2)",
                  transform: "translateY(-2px)",
                }}
                h="full"
                overflow="hidden"
              >
                <NextLink href={viewUrl(flow.id)}>
                  <Box p={6} h="full" display="flex" flexDirection="column" cursor="pointer">
                    {/* 头部 */}
                    <Flex justify="space-between" align="start" mb={4}>
                      <Flex align="center" gap={3} flex={1}>
                        <Box
                          w={10}
                          h={10}
                          borderRadius="lg"
                          bg="rgba(59, 130, 246, 0.2)"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          <LuSparkles size={20} color="#60a5fa" />
                        </Box>
                        <Heading size="sm" color="gray.50" fontWeight="600" flex={1}>
                          {flow.name}
                        </Heading>
                      </Flex>
                      <Box
                        as="button"
                        aria-label="删除洞察"
                        color="gray.400"
                        opacity={0.6}
                        _hover={{
                          color: "red.400",
                          opacity: 1,
                          transform: "scale(1.1)",
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(e, flow.id, flow.name);
                        }}
                        transition="all 0.2s"
                        cursor="pointer"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        p={1}
                        ml={2}
                      >
                        <LuTrash2 size={16} />
                      </Box>
                    </Flex>

                    {/* 主体内容 */}
                    <Box flex={1} mb={4}>
                      {/* 模型 Badge */}
                      <Badge
                        bg="rgba(59, 130, 246, 0.15)"
                        color="blue.300"
                        borderWidth="1px"
                        borderColor="rgba(59, 130, 246, 0.3)"
                        px={2}
                        py={1}
                        borderRadius="md"
                        fontSize="xs"
                        fontWeight="500"
                        mb={3}
                      >
                        {flow.model_id}
                      </Badge>

                      {/* 工具数量 */}
                      <Flex align="center" gap={2} color="gray.400">
                        <LuWrench size={14} />
                        <Text fontSize="sm">
                          {flow.enabled_tools?.length ?? 0} 个工具
                        </Text>
                      </Flex>
                    </Box>

                    {/* 底部提示 */}
                    <Flex
                      align="center"
                      gap={2}
                      color="gray.500"
                      fontSize="xs"
                      mt="auto"
                      pt={4}
                      borderTopWidth="1px"
                      borderColor="rgba(30, 41, 59, 1)"
                    >
                      <Text>点击进入可视化</Text>
                      <LuArrowRight size={14} />
                    </Flex>
                  </Box>
                </NextLink>
              </Box>
            ))}
          </SimpleGrid>
        )}

        {/* 空状态 */}
        {!loading && !error && flows.length === 0 && (
          <Box
            py={20}
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
          >
            <Box
              w={24}
              h={24}
              borderRadius="full"
              bg="rgba(59, 130, 246, 0.1)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mb={6}
            >
              <LuSparkles size={48} color="#60a5fa" opacity={0.5} />
            </Box>
            <Heading size="md" color="gray.300" mb={2}>
              还没有洞察
            </Heading>
            <Text color="gray.500" mb={6} maxW="md">
              创建你的第一个洞察，开始探索图谱数据与 AI 的交互体验
            </Text>
            <NextLink href="/create">
              <Box
                as="button"
                bg="blue.500"
                color="white"
                px={6}
                py={3}
                borderRadius="lg"
                fontWeight="600"
                _hover={{
                  bg: "blue.400",
                  transform: "translateY(-1px)",
                }}
                transition="all 0.2s"
              >
                创建洞察
              </Box>
            </NextLink>
          </Box>
        )}
      </Box>
    </Box>
  );
}
