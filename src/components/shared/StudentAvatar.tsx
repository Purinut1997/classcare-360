import { type ChangeEvent, useEffect, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';

import { resolveAppFileUrl } from '../../lib/storageGateway';

interface StudentAvatarProps {
  avatarFileId?: string | null;
  className?: string;
  disabled?: boolean;
  editable?: boolean;
  firstName: string;
  lastName?: string | null;
  onUploadFile?: (file: File) => Promise<void> | void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  workspaceId: string | null | undefined;
}

const SIZE_CLASSES: Record<NonNullable<StudentAvatarProps['size']>, string> = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-20 w-20 text-xl',
};

export function StudentAvatar({
  avatarFileId,
  className = '',
  disabled = false,
  editable = false,
  firstName,
  lastName,
  onUploadFile,
  size = 'md',
  workspaceId,
}: StudentAvatarProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!workspaceId || !avatarFileId) {
      setResolvedUrl(null);
      return;
    }

    void resolveAppFileUrl(workspaceId, avatarFileId).then((url) => {
      if (active) setResolvedUrl(url);
    });

    return () => {
      active = false;
    };
  }, [avatarFileId, workspaceId]);

  const initials = `${(firstName || '').slice(0, 1)}${(lastName || '').slice(0, 1)}`.trim() || 'นร';

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onUploadFile) return;

    setIsUploading(true);
    try {
      await onUploadFile(file);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`relative grid place-items-center overflow-hidden rounded-2xl border border-[#DCE5DD] bg-gradient-to-br from-[#EAF5EF] to-[#F6FAF7] font-black text-[#1C342B] shadow-2xs ${SIZE_CLASSES[size]}`}
      >
        {resolvedUrl ? (
          <img
            src={resolvedUrl}
            alt={`${firstName} ${lastName || ''}`.trim()}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span>{initials}</span>
        )}

        {isUploading ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/55 text-white">
            <Loader2 size={size === 'sm' ? 14 : 18} className="animate-spin" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      {editable && onUploadFile && !disabled ? (
        <label
          title="อัปโหลดภาพประจำตัว (.webp → Google Drive)"
          className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-2 border-white bg-[#1C342B] text-white shadow-sm transition hover:bg-[#2F7D5B] active:scale-95"
        >
          <Camera size={12} aria-hidden="true" />
          <input
            type="file"
            accept="image/*"
            disabled={isUploading}
            onChange={(event) => void handleFileChange(event)}
            className="sr-only"
          />
        </label>
      ) : null}
    </div>
  );
}
