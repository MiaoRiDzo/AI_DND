
import React from 'react'; // React import is not strictly necessary for JSX in modern setups if configured, but good for clarity.

interface IconProps {
  className?: string;
}

export const SwordsIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 .64l-2.25 2.25L8.64 12l-2.25 2.25L12 23.36l2.25-2.25L15.36 12l2.25-2.25L12 .64zm0 3.17L13.17 6l-6 6-1.17 1.17L6 13.17l6-6zm0 16.38L10.83 18l6-6 1.17-1.17L18 10.83l-6 6zM2 18h20v2H2v-2zm0-14h20v2H2V4z"/>
  </svg>
);

export const MagicWandIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M21.58 2.42a1.5 1.5 0 00-2.12 0L13 8.88l-1.17-1.17a3.5 3.5 0 00-4.95 0L2.42 12.17a1.5 1.5 0 000 2.12l7.46 7.46a1.5 1.5 0 002.12 0l4.46-4.46a3.5 3.5 0 000-4.95L15.12 11l6.46-6.46a1.5 1.5 0 000-2.12zM10.05 19.95l-6.4-6.4L6.5 10.7l1.17 1.17a1.5 1.5 0 002.12 0L13 9.88l5.3 5.3-1.41 1.41a1.5 1.5 0 000 2.12l-1.18 1.18-1.17-1.17a1.5 1.5 0 00-2.12 0l-2.35 2.35zM18 6l-2-2 1.29-1.29a.5.5 0 01.71 0l1.29 1.29a.5.5 0 010 .71L18 6z"/>
  </svg>
);

export const BowIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.29 3.71a1 1 0 00-1.41 0L12 10.59 5.12 3.71a1 1 0 00-1.41 0 1 1 0 000 1.41L10.59 12l-6.88 6.88a1 1 0 000 1.41 1 1 0 001.41 0L12 13.41l6.88 6.88a1 1 0 001.41 0 1 1 0 000-1.41L13.41 12l6.88-6.88a1 1 0 000-1.41zM4 11V7.52L7.52 11H4zm0 2h3.52L4 16.48V13zm16 0v3.48L16.48 13H20zm0-2h-3.52L20 7.52V11z"/>
  </svg>
);

export const PersonIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

export const PlayerCharacterIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className ?? "w-6 h-6"}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" />
  </svg>
);

export const ElfIcon = ({ className }: IconProps): JSX.Element => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2.5-8.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm5 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm-2.5 4c-2.33 0-4.31 1.46-5.11 3.5h10.22c-.8-2.04-2.78-3.5-5.11-3.5zM10 8V6h4v2l-2 2-2-2z"/>
    </svg>
);

export const DwarfIcon = ({ className }: IconProps): JSX.Element => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM8 11h8v2H8v-2zm-1.5 4c0-1.1.9-2 2-2h5c1.1 0 2 .9 2 2v1H6.5v-1zM12 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>
);

export const OrcIcon = ({ className }: IconProps): JSX.Element => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-10c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm4 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm-2 5c-1.66 0-3 1.34-3 3h6c0-1.66-1.34-3-3-3zm-5-3h2v-2H7v2zm8 0h2v-2h-2v2z"/>
    </svg>
);

export const ShieldIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3zm0 2.18L18.18 6.5V11c0 4.14-2.86 7.94-6.18 9.17C8.68 18.94 6 15.14 6 11V6.5L12 4.18z"/>
  </svg>
);

export const SingleSparkIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 1.5l.813 2.846a4.5 4.5 0 003.09 3.09L18.75 9l-2.846.813a4.5 4.5 0 00-3.09 3.09L12 15.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L5.25 9l2.846-.813a4.5 4.5 0 003.09-3.09L12 1.5z" />
  </svg>
);

export const ChevronLeftIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

export const ChevronRightIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

export const SparklesIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.25 12L17 14.188l-1.25-2.188a2.25 2.25 0 00-1.688-1.688L12 9l2.188-1.25a2.25 2.25 0 001.688-1.688L17 3.812 18.25 6l1.25 2.188a2.25 2.25 0 001.688 1.688L23.25 12l-2.188 1.25a2.25 2.25 0 00-1.688 1.688L18.25 18l-1.25-2.188a2.25 2.25 0 00-1.688-1.688L12 13.812l2.188-1.25a2.25 2.25 0 001.688-1.688L17 9.812l1.25-2.187z" />
  </svg>
);

export const SendIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
  </svg>
);

export const InfoIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className ?? "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

export const TargetIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className ?? "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> {/* Simple crosshair-like target */}
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

export const CogIcon = ({ className }: IconProps): JSX.Element => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className ?? "w-6 h-6"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93s.844.141 1.259-.032l.792-.42a1.125 1.125 0 011.37.491l.546.947c.275.476.058 1.08-.36 1.37l-.793.419c-.415.22-.69.606-.781 1.032L16.49 11.5c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93s-.844-.141-1.259.032l-.792.42a1.125 1.125 0 01-1.37-.491l-.546-.947a1.125 1.125 0 01.36-1.37l.793-.419c.415.22.69.606.781-1.032l.149-.894zM12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5zM10.343 15.94c.09.542.56.94 1.11.94h1.093c.55 0 1.02-.398 1.11-.94l.149-.894c.07-.424.384-.764.78-.93.398-.164.844-.14 1.259.031l.792.42a1.125 1.125 0 001.37-.49l.546-.947a1.125 1.125 0 00-.36-1.37l-.793-.419c-.415-.22-.69-.606-.781-1.032L16.49 12.5c-.09-.542-.56-.94-1.11.94h-1.094c-.55 0-1.019.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93s-.844-.141-1.259.032l-.792.42a1.125 1.125 0 00-1.37.491l-.546.947a1.125 1.125 0 00.36 1.37l.793.419c.415.22.69.606.781 1.032l.149.894z" />
    </svg>
);

export const BookOpenIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className ?? "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

export const UserCircleIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className ?? "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export const XMarkIcon = ({ className }: IconProps): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className ?? "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
