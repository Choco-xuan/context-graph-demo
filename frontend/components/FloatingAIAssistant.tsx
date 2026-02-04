"use client";

import {
  Box,
  Flex,
  Heading,
  Text,
  IconButton,
  HStack,
} from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { ChatInterface } from "./ChatInterface";
import type { Decision, GraphData, ChatMessage, FlowPreviewConfig } from "@/lib/api";

interface FloatingAIAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationHistory: ChatMessage[];
  onConversationUpdate: (messages: ChatMessage[]) => void;
  onDecisionSelect: (decision: Decision) => void;
  onGraphUpdate: (data: GraphData) => void;
  /** 决策追溯打开时，悬浮面板紧挨其左侧，中间无间隙 */
  decisionTraceOpen?: boolean;
  decisionTraceWidth?: number;
  /** 使用已发布的 Flow 配置 */
  flowId?: string | null;
  flowPreviewConfig?: FlowPreviewConfig | null;
}

/** 与决策追溯面板宽度一致 */
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 560;
/** 展开后紧挨底栏 */
const FIXED_BOTTOM = 0;
const FIXED_GAP = 24;

export function FloatingAIAssistant({
  open,
  onOpenChange,
  conversationHistory,
  onConversationUpdate,
  onDecisionSelect,
  onGraphUpdate,
  decisionTraceOpen = false,
  decisionTraceWidth = 0,
  flowId,
  flowPreviewConfig,
}: FloatingAIAssistantProps) {
  const rightOffset = decisionTraceOpen ? decisionTraceWidth : FIXED_GAP;

  if (!open) return null;

  return (
    <Box
      position="fixed"
      right={rightOffset}
      bottom={FIXED_BOTTOM}
      zIndex={25}
      w={PANEL_WIDTH}
      h={PANEL_HEIGHT}
      bg="blackAlpha.700"
      backdropFilter="blur(12px)"
      borderRadius="xl"
      borderBottomLeftRadius={0}
      borderBottomRightRadius={0}
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      boxShadow="2xl"
      display="flex"
      flexDirection="column"
      overflow="hidden"
      transition="right 0.25s ease-out, box-shadow 0.2s"
      _hover={{ boxShadow: "2xl" }}
    >
      {/* Header - 仅关闭 */}
      <Flex
        align="center"
        justify="space-between"
        px={4}
        py={2}
        bg="whiteAlpha.50"
        borderBottomWidth="1px"
        borderColor="whiteAlpha.100"
        flexShrink={0}
      >
        <HStack gap={2} flex={1} minW={0}>
          <Box w="2" h="2" borderRadius="full" bg="cyan.500" flexShrink={0} />
          <Heading size="sm" color="gray.100" whiteSpace="nowrap">
            AI 智能助手
          </Heading>
          <Text fontSize="xs" color="gray.400" whiteSpace="nowrap" truncate>
            通过对话探查本体关系
          </Text>
        </HStack>
        <IconButton
          aria-label="关闭"
          size="xs"
          variant="ghost"
          colorPalette="gray"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChange(false);
          }}
        >
          <LuX />
        </IconButton>
      </Flex>

      <Box flex={1} minH={0} overflow="hidden">
        <ChatInterface
          conversationHistory={conversationHistory}
          onConversationUpdate={onConversationUpdate}
          onDecisionSelect={onDecisionSelect}
          onGraphUpdate={onGraphUpdate}
          flowId={flowId}
          flowPreviewConfig={flowPreviewConfig}
        />
      </Box>
    </Box>
  );
}
