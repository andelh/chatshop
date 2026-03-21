import { StudioShellV2 } from "@/components/studio-v2/shell";

export default function StudioV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StudioShellV2>{children}</StudioShellV2>;
}
