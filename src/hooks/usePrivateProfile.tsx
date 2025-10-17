import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface PrivateProfileData {
  id: string;
  user_id: string;
  phone: string | null;
  membership_tier: string | null;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
}

export function usePrivateProfile() {
  const [privateData, setPrivateData] = useState<PrivateProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchPrivateData();
    } else {
      setPrivateData(null);
      setLoading(false);
    }
  }, [user]);

  const fetchPrivateData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('private_profile_data')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching private profile data:', error);
        toast({
          title: "Error loading private data",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setPrivateData(data);
    } catch (error) {
      console.error('Error fetching private profile data:', error);
      toast({
        title: "Error loading private data",
        description: "Failed to load your private profile data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePrivateData = async (updates: Partial<Pick<PrivateProfileData, 'phone' | 'membership_tier' | 'date_of_birth'>>) => {
    if (!user) return { error: 'No user found' };

    try {
      // Sanitize input before saving
      const sanitizedUpdates = {
        ...updates,
        phone: updates.phone?.trim() || null
      };

      if (privateData) {
        // Update existing record
        const { data, error } = await supabase
          .from('private_profile_data')
          .update(sanitizedUpdates)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          toast({
            title: "Update failed",
            description: error.message,
            variant: "destructive",
          });
          return { error };
        }

        setPrivateData(data);
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('private_profile_data')
          .insert({
            user_id: user.id,
            ...sanitizedUpdates
          })
          .select()
          .single();

        if (error) {
          toast({
            title: "Update failed",
            description: error.message,
            variant: "destructive",
          });
          return { error };
        }

        setPrivateData(data);
      }

      toast({
        title: "Private data updated",
        description: "Your private information has been successfully updated.",
      });

      return { data: privateData };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update private data';
      toast({
        title: "Update failed",
        description: errorMessage,
        variant: "destructive",
      });
      return { error: errorMessage };
    }
  };

  return {
    privateData,
    loading,
    updatePrivateData,
    refetch: fetchPrivateData,
  };
}