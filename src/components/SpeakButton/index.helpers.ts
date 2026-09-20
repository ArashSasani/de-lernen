export function speakButtonClass(speaking: boolean): string {
  return speaking
    ? 'animate-pulse !text-primary'
    : '!text-base-content/60 hover:!text-base-content';
}
