"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./GalleryPageTransition.module.css";

const PHOTO_POSITIONS = [
  { left: "-4%", delay: "0ms", depth: "0", rotate: "-4deg", duration: "2400ms" },
  { left: "12%", delay: "140ms", depth: "-4rem", rotate: "3deg", duration: "2800ms" },
  { left: "28%", delay: "40ms", depth: "-2rem", rotate: "-2deg", duration: "2600ms" },
  { left: "46%", delay: "220ms", depth: "-6rem", rotate: "5deg", duration: "3000ms" },
  { left: "64%", delay: "90ms", depth: "-3rem", rotate: "-3deg", duration: "2700ms" },
  { left: "82%", delay: "180ms", depth: "-5rem", rotate: "2deg", duration: "2900ms" },
  { left: "6%", delay: "520ms", depth: "-1rem", rotate: "4deg", duration: "2550ms" },
  { left: "36%", delay: "600ms", depth: "-4rem", rotate: "-5deg", duration: "2850ms" },
  { left: "58%", delay: "480ms", depth: "-2rem", rotate: "3deg", duration: "2650ms" },
  { left: "76%", delay: "700ms", depth: "-6rem", rotate: "-2deg", duration: "3100ms" },
];

const TRANSITION_IMAGES = [
  "/images/gallery-transition/1940s.webp",
  "/images/gallery-transition/1950s.webp",
  "/images/gallery-transition/cavemen.webp",
  "/images/gallery-transition/pioneer.webp",
  "/images/gallery-transition/spindletop.webp",
  "/images/gallery-transition/delaware.webp",
];

const INTRO_DURATION_MS = 3200;
const PRELOAD_TIMEOUT_MS = 4500;

function preloadImage(src: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.decoding = "async";
    image.onload = async () => {
      try {
        if ("decode" in image) {
          await image.decode();
        }

        resolve(src);
      } catch {
        resolve(src);
      }
    };
    image.onerror = reject;
    image.src = src;
  });
}

export default function GalleryPageTransition() {
  const [isVisible, setIsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [readyImages, setReadyImages] = useState<string[]>([]);

  const transitionImages = useMemo(() => {
    return TRANSITION_IMAGES;
  }, []);

  useEffect(() => {
    let isMounted = true;
    let hideTimeout: number | undefined;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setIsVisible(false);
      return;
    }

    async function prepareTransition() {
      const loadedSoFar: string[] = [];

      const timeout = new Promise<string[]>((resolve) => {
        window.setTimeout(() => resolve(loadedSoFar), PRELOAD_TIMEOUT_MS);
      });

      const preloadedImages = Promise.allSettled(
        transitionImages.map((src) =>
          preloadImage(src).then((loadedSrc) => {
            loadedSoFar.push(loadedSrc);
            return loadedSrc;
          })
        )
      ).then((results) =>
        results
          .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
          .map((result) => result.value)
      );

      const loadedImages = await Promise.race([preloadedImages, timeout]);

      if (!isMounted) return;

      if (loadedImages.length === 0) {
        setIsVisible(false);
        return;
      }

      setReadyImages(
        PHOTO_POSITIONS.map((_, index) => loadedImages[index % loadedImages.length])
      );
      setIsPlaying(true);

      hideTimeout = window.setTimeout(() => {
        setIsVisible(false);
      }, INTRO_DURATION_MS);
    }

    prepareTransition();

    return () => {
      isMounted = false;

      if (hideTimeout) {
        window.clearTimeout(hideTimeout);
      }
    };
  }, [transitionImages]);

  if (!isVisible) return null;

  return (
    <div
      className={`${styles.overlay} ${isPlaying ? styles.playing : ""} pointer-events-none fixed inset-0 z-50 overflow-hidden`}
      aria-hidden="true"
    >
      <div className={`${styles.stream} absolute inset-0`}>
        {readyImages.map((src, index) => {
          const position = PHOTO_POSITIONS[index];

          return (
            <img
              key={`${src}-${index}`}
              src={src}
              alt=""
              className={`${styles.photo} absolute aspect-[4/5] rounded-2xl border border-white/60 object-cover shadow-2xl`}
              style={{
                "--rise-left": position.left,
                "--rise-delay": position.delay,
                "--rise-depth": position.depth,
                "--rise-rotate": position.rotate,
                "--rise-duration": position.duration,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
    </div>
  );
}
