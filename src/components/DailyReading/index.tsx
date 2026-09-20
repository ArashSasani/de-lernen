'use client';

import { useState } from 'react';
import type { DailyText } from '@/types';
import { toSegments, resolveHighlight } from './index.helpers';
import { useSpeech } from '@/hooks/useSpeech';
import { useOnline } from '@/hooks/useOnline';
import { useAiConfigured } from '@/hooks/useAiConfigured';
import { isAiEnabled } from '@/lib/ai-prefs';
import WordPopover from '@/components/WordPopover';

export default function DailyReading({
  text,
  strugglingIds,
  highlightAll = false,
  onGrade,
  onUnauthorized,
}: {
  text: DailyText;
  // Study page: omit highlightAll (default false) — only words in this set
  // are highlighted; others render as plain text.
  // Read page: pass highlightAll — every annotated word is highlighted, but
  // words in this set get the indigo (struggling) style; others get slate.
  strugglingIds?: ReadonlySet<string>;
  highlightAll?: boolean;
  onGrade?: (wordId: string) => void;
  onUnauthorized?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { available, speaking, speak } = useSpeech();
  // Read once here rather than once per highlighted span — a text can have
  // dozens of spans, each of which would otherwise mount its own `online`
  // listener pair and re-read localStorage on every render.
  const online = useOnline();
  // Deployed without ANTHROPIC_API_KEY: hide the AI chip row even if the
  // per-device toggle is still on — the layer has nothing to call.
  const aiConfigured = useAiConfigured(onUnauthorized);
  const aiEnabled = isAiEnabled() && aiConfigured;

  const segments = toSegments(text.text, text.spans);

  return (
    <div className="flex flex-col gap-4">
      {openId && (
        <button
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-[9]"
          onClick={() => setOpenId(null)}
        />
      )}
      <header className="flex flex-col gap-1">
        <span className="text-primary text-xs font-medium tracking-wide uppercase">
          {text.topic}
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{text.title}</h2>
      </header>

      <p className="text-justify text-[16px] leading-relaxed whitespace-pre-line md:text-[18px] md:leading-[1.8]">
        {segments.map((seg, i) => {
          if (!seg.wordId) return <span key={i}>{seg.text}</span>;

          const { isStruggling, shouldHighlight } = resolveHighlight(
            seg.wordId,
            strugglingIds,
            highlightAll,
          );

          return shouldHighlight ? (
            <WordPopover
              key={i}
              surface={seg.text}
              wordId={seg.wordId}
              isStruggling={isStruggling}
              open={openId === `${seg.wordId}-${i}`}
              onToggle={() =>
                setOpenId((cur) =>
                  cur === `${seg.wordId}-${i}` ? null : `${seg.wordId}-${i}`,
                )
              }
              onGrade={
                onGrade && isStruggling
                  ? () => {
                      onGrade(seg.wordId!);
                      setOpenId(null);
                    }
                  : undefined
              }
              speakAvailable={available}
              speaking={speaking}
              onSpeak={speak}
              onUnauthorized={onUnauthorized}
              online={online}
              aiEnabled={aiEnabled}
            />
          ) : (
            <span key={i}>{seg.text}</span>
          );
        })}
      </p>
    </div>
  );
}
