import { AvatarImage } from "@/components/ui/avatar";
import { useSignedAvatarUrl } from "@/lib/avatarUrl";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof AvatarImage>, "src"> & {
  /** Stored profile_picture_url (path or legacy public URL). */
  src?: string | null;
};

/**
 * AvatarImage variant that resolves a stored profile-picture reference
 * to a short-lived signed URL. Renders nothing while resolving so the
 * AvatarFallback shows in the meantime.
 */
export function SignedAvatarImage({ src, ...rest }: Props) {
  const signed = useSignedAvatarUrl(src);
  if (!signed) return null;
  return <AvatarImage src={signed} {...rest} />;
}
