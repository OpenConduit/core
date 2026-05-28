/**
 * useSkillAutoApply
 *
 * Watches for new (empty) conversations and automatically injects the content
 * of any skills flagged with `autoApply: true` in their frontmatter as the
 * conversation's system prompt.
 *
 * Only fires once per conversation — subsequent switches back to the same
 * conversation are ignored. Also skips conversations that already have a
 * system prompt set, so user-configured prompts are never overwritten.
 */

import { useEffect, useRef } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';

export function useSkillAutoApply(): void {
  const { activeConversationId } = useUiStore();
  const { conversations, updateConversation } = useConversationStore();
  const { settings } = useSettingsStore();

  // Track which conversation IDs we have already processed so we don't
  // re-apply every time the conversations array reference changes.
  const processedRef = useRef(new Set<string>());

  useEffect(() => {
    // Bail early if the feature is disabled in settings (defaults to enabled)
    if (settings?.features?.skills === false) return;
    if (!activeConversationId) return;
    if (processedRef.current.has(activeConversationId)) return;
    if (!window.api?.skills?.list) return;

    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv) return;

    // Only auto-apply to brand-new conversations with no messages and no
    // existing system prompt.
    if (conv.messages.length > 0 || conv.systemPrompt?.trim()) return;

    // Mark as processed immediately so concurrent renders don't double-fire.
    processedRef.current.add(activeConversationId);

    void window.api.skills.list().then((skills) => {
      const autoApplySkills = skills.filter((s) => s.autoApply);
      if (autoApplySkills.length === 0) return;

      const combined = autoApplySkills.map((s) => s.content).join('\n\n---\n\n');
      updateConversation(activeConversationId, { systemPrompt: combined });
    });
  }, [activeConversationId, conversations, settings, updateConversation]);
}
