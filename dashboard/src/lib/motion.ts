export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
} as const;

export const fadeInLeft = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
} as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
} as const;
