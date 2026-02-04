"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Flex, Heading, Text, Spinner, SimpleGrid } from "@chakra-ui/react";
import NextLink from "next/link";
import { LuTrash2 } from "react-icons/lu";
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
    <Box minH="100vh" bg="#0a0e17" color="gray.100" p={6}>
      <Flex justify="space-between" align="center" mb={8}>
        <Heading size="lg">洞察列表</Heading>
        <NextLink href="/create">
          <Text color="blue.300" cursor="pointer" _hover={{ color: "blue.200" }}>
            创建洞察
          </Text>
        </NextLink>
      </Flex>

      <Text fontSize="sm" color="gray.400" mb={6}>
        点击任意洞察进入图谱可视化与 AI 对话面板
      </Text>

      {loading && (
        <Flex justify="center" py={12}>
          <Spinner size="lg" color="blue.400" />
        </Flex>
      )}

      {error && (
        <Text color="red.300" py={4}>
          {error}
        </Text>
      )}

      {!loading && !error && flows.length === 0 && (
        <Text color="gray.400" py={8}>
          暂无已发布的洞察，请先
          <NextLink href="/create">
            <Text as="span" color="blue.300" cursor="pointer" ml={1}>
              创建并发布
            </Text>
          </NextLink>
        </Text>
      )}

      {!loading && !error && flows.length > 0 && (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
          {flows.map((flow) => (
            <Box
              key={flow.id}
              position="relative"
              borderRadius="lg"
              bg="whiteAlpha.50"
              borderWidth="1px"
              borderColor="whiteAlpha.100"
              boxShadow="sm"
              _hover={{
                borderColor: "blue.400",
                boxShadow: "md",
                transform: "translateY(-1px)",
                bg: "whiteAlpha.100",
              }}
              transition="all 0.2s"
              h="full"
            >
              <NextLink href={viewUrl(flow.id)}>
                <Box
                  p={5}
                  cursor="pointer"
                  h="full"
                  display="flex"
                  flexDirection="column"
                >
                  <Flex justify="space-between" align="start" mb={2}>
                    <Heading size="sm" color="gray.50" fontWeight="medium">
                      {flow.name}
                    </Heading>
                  </Flex>
                  <Text fontSize="xs" color="gray.400" mb={3}>
                    模型: {flow.model_id}
                  </Text>
                  <Text fontSize="sm" color="gray.500" mt="auto">
                    {flow.enabled_tools?.length ?? 0} 个工具 · 点击进入可视化
                  </Text>
                </Box>
              </NextLink>
              <Box
                as="button"
                aria-label="删除洞察"
                position="absolute"
                top={3}
                right={3}
                color="blue.400"
                opacity={0.7}
                _hover={{
                  color: "blue.200",
                  opacity: 1,
                  transform: "scale(1.1)",
                }}
                onClick={(e) => handleDelete(e, flow.id, flow.name)}
                zIndex={20}
                transition="all 0.2s"
                cursor="pointer"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                }}
              >
                <LuTrash2 size={18} />
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
