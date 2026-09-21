import Image from "next/image";
import { cn } from "@/lib/utils";
import { MASCOT_POSES, type MascotPoseName } from "./mascot-poses";

// Height is the one size a caller may pick; width follows the PNG's aspect ratio.
const SIZE_CLASS = { md: "h-40 w-auto", lg: "h-56 w-auto" } as const;

export function MascotPose({
  pose,
  size,
  className,
}: {
  pose: MascotPoseName;
  size: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const { file, width, height } = MASCOT_POSES[pose];
  return (
    <Image
      data-mascot-pose={pose}
      data-size={size}
      src={`/mascot/poses/${file}`}
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      unoptimized
      className={cn(SIZE_CLASS[size], "select-none", className)}
    />
  );
}
