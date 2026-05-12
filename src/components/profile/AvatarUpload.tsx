import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Pencil, Upload, Trash2, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSignedAvatarUrl } from '@/lib/avatarUrl';

interface AvatarUploadProps {
  currentImageUrl?: string;
  onImageUpdate: (imageUrl: string | null) => void;
  disabled?: boolean;
}

export function AvatarUpload({ currentImageUrl, onImageUpdate, disabled }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true, // Replace existing file
        });

      if (error) {
        throw error;
      }

      // Bucket is private — store the storage path; UI resolves to signed URLs.
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      onImageUpdate(fileName);

      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been successfully uploaded.",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user || !currentImageUrl) return;

    setUploading(true);

    try {
      // Extract filename from URL
      const fileName = `${user.id}/avatar.jpg`; // Assuming jpg, could be improved
      
      // Delete from storage
      const { error } = await supabase.storage
        .from('profile-pictures')
        .remove([fileName]);

      if (error && error.message !== 'Object not found') {
        throw error;
      }

      setPreviewUrl(null);
      onImageUpdate(null);

      toast({
        title: "Profile picture removed",
        description: "Your profile picture has been removed.",
      });
    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: "Remove failed",
        description: error instanceof Error ? error.message : "Failed to remove image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const signedCurrent = useSignedAvatarUrl(currentImageUrl);
  const displayImageUrl = previewUrl || signedCurrent;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="w-20 h-20 border-2 border-border">
          <AvatarImage src={displayImageUrl || undefined} alt="Profile picture" />
          <AvatarFallback className="bg-gradient-primary text-primary-foreground text-lg">
            {user?.email?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>

        {!disabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="default"
                disabled={uploading}
                aria-label={displayImageUrl ? 'Edit profile picture' : 'Upload profile picture'}
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full p-0 shadow-md border-2 border-background"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Pencil className="w-3.5 h-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {displayImageUrl ? 'Change photo' : 'Upload photo'}
              </DropdownMenuItem>
              {displayImageUrl && (
                <DropdownMenuItem
                  onClick={handleRemoveImage}
                  disabled={uploading}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove photo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}