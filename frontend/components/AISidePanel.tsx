"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  IconButton,
  HStack,
} from "@chakra-ui/react";
import { LuMinus, LuPlus, LuX } from "react-icons/lu";
import { ChatInterface } from "./ChatInterface";
import type { Decision, GraphData, ChatMessage } from "@/lib/api";

interface AISidePanelProps {
  conversationHistory: ChatMessage[];
  onConversationUpdate: (messages: ChatMessage[]) => void;
  onDecisionSelect: (decision: Decision) => void;
  onGraphUpdate: (data: GraphData) => void;
}

const PANEL_WIDTH = 380;
const COLLAPSED_WIDTH = 48;

export function AISidePanel({
  conversationHistory,
  onConversationUpdate,
  onDecisionSelect,
  onGraphUpdate,
}: AISidePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box
      flexShrink={0}
      w={collapsed ? COLLAPSED_WIDTH : PANEL_WIDTH}
      h="100%"
      bg="blackAlpha.700"
      backdropFilter="blur(12px)"
      borderLeftWidth="1px"
      borderColor="whiteAlpha.200"
      display="flex"
      flexDirection="column"
      overflow="hidden"
      transition="width 0.25s ease-out"
    >
      {/* Header: AI 智能助手 + 最小化/关闭 */}
      <Flex
        align="center"
        justify="space-between"
        px={collapsed ? 2 : 4}
        py={2}
        bg="whiteAlpha.50"
        borderBottomWidth="1px"
        borderColor="whiteAlpha.100"
        flexShrink={0}
      >
        {!collapsed && (
          <HStack gap={2} flex={1} minW={0}>
            <Box w="2" h="2" borderRadius="full" bg="cyan.500" flexShrink={0} />
            <Heading size="sm" color="gray.100" whiteSpace="nowrap">
              AI 智能助手
            </Heading>
            <Text fontSize="xs" color="gray.400" whiteSpace="nowrap" truncate>
              通过对话探查本体关系
            </Text>
          </HStack>
        )}
        <HStack gap={1}>
          <IconButton
            aria-label={collapsed ? "展开" : "最小化"}
            size="xs"
            variant="ghost"
            colorPalette="gray"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <LuPlus /> : <LuMinus />}
          </IconButton>
          {!collapsed && (
            <IconButton
              aria-label="关闭"
              size="xs"
              variant="ghost"
              colorPalette="gray"
              onClick={() => setCollapsed(true)}
            >
              <LuX />
            </IconButton>
          )}
        </HStack>
      </Flex>

      {!collapsed && (
        <Box flex={1} minH={0} overflow="hidden">
          <ChatInterface
            conversationHistory={conversationHistory}
            onConversationUpdate={onConversationUpdate}
            onDecisionSelect={onDecisionSelect}
            onGraphUpdate={onGraphUpdate}
          />
        </Box>
      )}
    </Box>
  );
}
