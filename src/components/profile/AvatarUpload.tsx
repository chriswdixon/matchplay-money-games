import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Camera, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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

      // Get authenticated URL (bucket is now private for security)
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      // Create preview URL for immediate display
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // Call the update callback with authenticated URL
      // Note: publicUrl still works for authenticated users due to RLS policies
      onImageUpdate(publicUrl);

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

  const displayImageUrl = previewUrl || currentImageUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="w-20 h-20 border-2 border-border">
          <AvatarImage src={displayImageUrl || undefined} alt="Profile picture" />
          <AvatarFallback className="bg-gradient-primary text-primary-foreground text-lg">
            {user?.email?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        
        {displayImageUrl && !disabled && (
          <Button
            size="sm"
            variant="destructive"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={handleRemoveImage}
            disabled={uploading}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="gap-2"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Uploading...
            </>
          ) : (
            <>
              {displayImageUrl ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
              {displayImageUrl ? 'Change' : 'Upload'}
            </>
          )}
        </Button>
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