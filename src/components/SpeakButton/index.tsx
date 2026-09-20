'use client';

import { SpeakerWaveIcon } from '@heroicons/react/24/solid';
import { speakButtonClass } from './index.helpers';

export default function SpeakButton({
  text,
  speaking,
  onSpeak,
  className,
}: {
  text: string;
  speaking: boolean;
  onSpeak: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Pronounce"
      className={`btn btn-circle btn-text ${speakButtonClass(speaking)} ${className ?? ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSpeak();
      }}
    >
      <SpeakerWaveIcon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
